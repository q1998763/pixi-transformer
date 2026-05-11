import {
  Container,
  FederatedPointerEvent,
  Graphics,
  Matrix,
  Point,
  Rectangle,
} from 'pixi.js';

export type TransformerAnchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-right'
  | 'bottom-right'
  | 'bottom-center'
  | 'bottom-left'
  | 'middle-left'
  | 'rotater';

export interface TransformerBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface PixiTransformerOptions {
  nodes?: Container[];
  enabledAnchors?: TransformerAnchor[];
  resizeEnabled?: boolean;
  rotateEnabled?: boolean;
  rotateAnchorOffset?: number;
  padding?: number;
  anchorSize?: number;
  anchorFill?: number;
  anchorStroke?: number;
  anchorStrokeWidth?: number;
  borderStroke?: number;
  borderStrokeWidth?: number;
  keepRatio?: boolean;
  centeredScaling?: boolean;
  flipEnabled?: boolean;
  useSingleNodeRotation?: boolean;
  boundBoxFunc?: (oldBox: TransformerBox, newBox: TransformerBox) => TransformerBox;
}

type DragMode = 'move' | 'resize' | 'rotate';

interface DragState {
  mode: DragMode;
  anchor?: TransformerAnchor;
  pointerStart: Point;
  startBox: TransformerBox;
  startContentBox: TransformerBox;
  startWorldMatrices: Matrix[];
  startPositions: Point[];
}

const DEFAULT_ANCHORS: TransformerAnchor[] = [
  'top-left',
  'top-center',
  'top-right',
  'middle-right',
  'bottom-right',
  'bottom-center',
  'bottom-left',
  'middle-left',
];

const CURSORS: Record<TransformerAnchor, string> = {
  'top-left': 'nwse-resize',
  'top-center': 'ns-resize',
  'top-right': 'nesw-resize',
  'middle-right': 'ew-resize',
  'bottom-right': 'nwse-resize',
  'bottom-center': 'ns-resize',
  'bottom-left': 'nesw-resize',
  'middle-left': 'ew-resize',
  rotater: 'grab',
};

const EPSILON = 0.000001;

export class PixiTransformer extends Container {
  public options: Required<Omit<PixiTransformerOptions, 'nodes' | 'boundBoxFunc'>> &
    Pick<PixiTransformerOptions, 'boundBoxFunc'>;

  private readonly border = new Graphics();
  private readonly anchors = new Map<TransformerAnchor, Graphics>();
  private readonly targets: Container[] = [];
  private dragState: DragState | null = null;
  private box: TransformerBox | null = null;

  public constructor(options: PixiTransformerOptions = {}) {
    super();

    this.options = {
      enabledAnchors: options.enabledAnchors ?? DEFAULT_ANCHORS,
      resizeEnabled: options.resizeEnabled ?? true,
      rotateEnabled: options.rotateEnabled ?? true,
      rotateAnchorOffset: options.rotateAnchorOffset ?? 38,
      padding: options.padding ?? 0,
      anchorSize: options.anchorSize ?? 10,
      anchorFill: options.anchorFill ?? 0xffffff,
      anchorStroke: options.anchorStroke ?? 0x1a73e8,
      anchorStrokeWidth: options.anchorStrokeWidth ?? 2,
      borderStroke: options.borderStroke ?? 0x1a73e8,
      borderStrokeWidth: options.borderStrokeWidth ?? 1.5,
      keepRatio: options.keepRatio ?? false,
      centeredScaling: options.centeredScaling ?? false,
      flipEnabled: options.flipEnabled ?? true,
      useSingleNodeRotation: options.useSingleNodeRotation ?? true,
      boundBoxFunc: options.boundBoxFunc,
    };

    this.eventMode = 'static';
    this.cursor = 'move';
    this.sortableChildren = true;
    this.border.eventMode = 'static';
    this.border.cursor = 'move';
    this.addChild(this.border);

    this.on('pointerdown', this.onBorderPointerDown, this);
    this.on('globalpointermove', this.onGlobalPointerMove, this);
    this.on('pointerup', this.onGlobalPointerUp, this);
    this.on('pointerupoutside', this.onGlobalPointerUp, this);
    this.on('globalpointerup', this.onGlobalPointerUp, this);
    this.on('globalpointerupoutside', this.onGlobalPointerUp, this);

    this.nodes(options.nodes ?? []);
  }

  public nodes(nodes?: Container[]): Container[] {
    if (!nodes) {
      return [...this.targets];
    }

    this.targets.length = 0;
    this.targets.push(...nodes);
    this.update();
    return [...this.targets];
  }

  public attachTo(...nodes: Container[]): this {
    this.nodes(nodes);
    return this;
  }

  public detach(): this {
    this.nodes([]);
    return this;
  }

  public update(): this {
    this.box = this.computeBox();
    this.visible = Boolean(this.box);
    this.redraw();
    return this;
  }

  public getBox(): TransformerBox | null {
    return this.box ? { ...this.box } : null;
  }

  public setBox(box: TransformerBox | null): this {
    this.box = box ? { ...box } : null;
    this.visible = Boolean(this.box);
    this.redraw();
    return this;
  }

  private redraw(): void {
    this.border.clear();

    for (const anchor of this.anchors.values()) {
      anchor.visible = false;
    }

    if (!this.box) {
      return;
    }

    const box = this.box;
    const corners = getBoxCorners(box);

    this.border
      .poly(corners.flatMap((p) => [p.x, p.y]))
      .closePath()
      .stroke({ color: this.options.borderStroke, width: this.options.borderStrokeWidth });

    if (this.options.rotateEnabled) {
      const topCenter = midpoint(corners[0], corners[1]);
      const rotateDirection = mul(unitY(box.rotation), -Math.sign(box.height || 1));
      const rotatePoint = add(topCenter, mul(rotateDirection, this.options.rotateAnchorOffset));
      this.border
        .moveTo(topCenter.x, topCenter.y)
        .lineTo(rotatePoint.x, rotatePoint.y)
        .stroke({ color: this.options.borderStroke, width: this.options.borderStrokeWidth });
      this.drawAnchor('rotater', rotatePoint, true);
    }

    if (this.options.resizeEnabled) {
      const positions: Record<TransformerAnchor, Point> = {
        'top-left': corners[0],
        'top-center': midpoint(corners[0], corners[1]),
        'top-right': corners[1],
        'middle-right': midpoint(corners[1], corners[2]),
        'bottom-right': corners[2],
        'bottom-center': midpoint(corners[2], corners[3]),
        'bottom-left': corners[3],
        'middle-left': midpoint(corners[3], corners[0]),
        rotater: new Point(),
      };

      for (const anchor of this.options.enabledAnchors) {
        if (anchor !== 'rotater') {
          this.drawAnchor(anchor, positions[anchor], false);
        }
      }
    }
  }

  private drawAnchor(anchorName: TransformerAnchor, position: Point, round: boolean): void {
    let anchor = this.anchors.get(anchorName);

    if (!anchor) {
      anchor = new Graphics();
      anchor.eventMode = 'static';
      anchor.cursor = CURSORS[anchorName];
      anchor.zIndex = 1;
      anchor.on('pointerdown', (event) => this.onAnchorPointerDown(event, anchorName));
      this.anchors.set(anchorName, anchor);
      this.addChild(anchor);
    }

    const size = this.options.anchorSize;
    anchor.clear();
    if (round) {
      anchor
        .circle(0, 0, size * 0.55)
        .fill(this.options.anchorFill)
        .stroke({ color: this.options.anchorStroke, width: this.options.anchorStrokeWidth });
    } else {
      anchor
        .rect(-size / 2, -size / 2, size, size)
        .fill(this.options.anchorFill)
        .stroke({ color: this.options.anchorStroke, width: this.options.anchorStrokeWidth });
    }
    anchor.position.copyFrom(position);
    anchor.rotation = this.box?.rotation ?? 0;
    anchor.visible = true;
  }

  private onBorderPointerDown(event: FederatedPointerEvent): void {
    if (event.target !== this.border && event.target !== this) {
      return;
    }

    const box = this.box;
    if (!box || this.targets.length === 0) {
      return;
    }

    event.stopPropagation();
    this.dragState = this.createDragState('move', event.global);
  }

  private onAnchorPointerDown(event: FederatedPointerEvent, anchor: TransformerAnchor): void {
    const box = this.box;
    if (!box || this.targets.length === 0) {
      return;
    }

    event.stopPropagation();
    this.dragState = this.createDragState(anchor === 'rotater' ? 'rotate' : 'resize', event.global, anchor);
  }

  private onGlobalPointerMove(event: FederatedPointerEvent): void {
    if (!this.dragState) {
      return;
    }

    if (isPrimaryButtonReleased(event)) {
      this.onGlobalPointerUp();
      return;
    }

    const state = this.dragState;
    let nextBox: TransformerBox;

    if (state.mode === 'move') {
      const dx = event.global.x - state.pointerStart.x;
      const dy = event.global.y - state.pointerStart.y;
      nextBox = { ...state.startBox, x: state.startBox.x + dx, y: state.startBox.y + dy };
    } else if (state.mode === 'rotate') {
      nextBox = this.getRotatedBox(state, event.global);
    } else {
      nextBox = this.getResizedBox(state, event.global);
    }

    const bounded = this.options.boundBoxFunc?.(state.startBox, nextBox) ?? nextBox;
    this.applyBoxTransform(state, bounded);
    this.box = bounded;
    this.redraw();
  }

  private onGlobalPointerUp(): void {
    if (!this.dragState) {
      return;
    }

    this.dragState = null;
    this.redraw();
  }

  private createDragState(mode: DragMode, pointerStart: Point, anchor?: TransformerAnchor): DragState {
    for (const target of this.targets) {
      updateTargetTransform(target);
    }

    return {
      mode,
      anchor,
      pointerStart: pointerStart.clone(),
      startBox: { ...this.box! },
      startContentBox: contentBoxFromVisualBox(this.box!, this.options.padding),
      startWorldMatrices: this.targets.map((target) => getWorldMatrix(target)),
      startPositions: this.targets.map((target) => target.position.clone()),
    };
  }

  private getRotatedBox(state: DragState, pointer: Point): TransformerBox {
    const box = state.startBox;
    const center = getBoxCenter(box);
    const startAngle = Math.atan2(state.pointerStart.y - center.y, state.pointerStart.x - center.x);
    const angle = Math.atan2(pointer.y - center.y, pointer.x - center.x);
    return boxFromCenter(center, box.width, box.height, box.rotation + angle - startAngle);
  }

  private getResizedBox(state: DragState, pointer: Point): TransformerBox {
    const box = state.startBox;
    const anchor = state.anchor!;
    const xAxis = unitX(box.rotation);
    const yAxis = unitY(box.rotation);
    const horizontal = anchor.includes('left') || anchor.includes('right');
    const vertical = anchor.includes('top') || anchor.includes('bottom');
    let width: number;
    let height: number;

    if (this.options.centeredScaling) {
      const center = getBoxCenter(box);
      const rel = sub(pointer, center);
      const projectedWidth = dot(rel, xAxis) * 2;
      const projectedHeight = dot(rel, yAxis) * 2;

      if (anchor.includes('left')) {
        width = -projectedWidth;
      } else if (anchor.includes('right')) {
        width = projectedWidth;
      } else {
        width = box.width;
      }

      if (anchor.includes('top')) {
        height = -projectedHeight;
      } else if (anchor.includes('bottom')) {
        height = projectedHeight;
      } else {
        height = box.height;
      }
    } else {
      const fixed = this.getFixedPoint(box, anchor);
      const rel = sub(pointer, fixed);
      width = dot(rel, xAxis);
      height = dot(rel, yAxis);

      if (anchor.includes('left')) {
        width = -width;
      } else if (!horizontal) {
        width = box.width;
      }

      if (anchor.includes('top')) {
        height = -height;
      } else if (!vertical) {
        height = box.height;
      }
    }

    if (this.options.keepRatio && horizontal && vertical && Math.abs(box.height) > EPSILON) {
      const ratio = Math.abs(box.width / box.height);
      if (Math.abs(width / height) > ratio) {
        height = Math.sign(height || 1) * Math.abs(width / ratio);
      } else {
        width = Math.sign(width || 1) * Math.abs(height * ratio);
      }
    }

    if (!this.options.flipEnabled) {
      width = Math.max(EPSILON, width);
      height = Math.max(EPSILON, height);
    }

    return this.options.centeredScaling
      ? boxFromCenter(getBoxCenter(box), width, height, box.rotation)
      : this.boxFromFixedPoint(box, anchor, this.getFixedPoint(box, anchor), width, height);
  }

  private getFixedPoint(box: TransformerBox, anchor: TransformerAnchor): Point {
    const corners = getBoxCorners(box);

    if (this.options.centeredScaling) {
      return getBoxCenter(box);
    }

    switch (anchor) {
      case 'top-left':
        return corners[2];
      case 'top-center':
        return midpoint(corners[2], corners[3]);
      case 'top-right':
        return corners[3];
      case 'middle-right':
        return midpoint(corners[3], corners[0]);
      case 'bottom-right':
        return corners[0];
      case 'bottom-center':
        return midpoint(corners[0], corners[1]);
      case 'bottom-left':
        return corners[1];
      case 'middle-left':
        return midpoint(corners[1], corners[2]);
      default:
        return getBoxCenter(box);
    }
  }

  private boxFromFixedPoint(
    box: TransformerBox,
    anchor: TransformerAnchor,
    fixed: Point,
    width: number,
    height: number,
  ): TransformerBox {
    const xAxis = unitX(box.rotation);
    const yAxis = unitY(box.rotation);

    if (this.options.centeredScaling) {
      return {
        ...box,
        x: fixed.x - (xAxis.x * width + yAxis.x * height) / 2,
        y: fixed.y - (xAxis.y * width + yAxis.y * height) / 2,
        width,
        height,
      };
    }

    const fixedCoords: Record<TransformerAnchor, [number, number]> = {
      'top-left': [1, 1],
      'top-center': [0.5, 1],
      'top-right': [0, 1],
      'middle-right': [0, 0.5],
      'bottom-right': [0, 0],
      'bottom-center': [0.5, 0],
      'bottom-left': [1, 0],
      'middle-left': [1, 0.5],
      rotater: [0.5, 0.5],
    };
    const [fx, fy] = fixedCoords[anchor];

    return {
      ...box,
      x: fixed.x - xAxis.x * width * fx - yAxis.x * height * fy,
      y: fixed.y - xAxis.y * width * fx - yAxis.y * height * fy,
      width,
      height,
    };
  }

  private applyBoxTransform(state: DragState, nextBox: TransformerBox): void {
    if (state.mode === 'move') {
      const dx = nextBox.x - state.startBox.x;
      const dy = nextBox.y - state.startBox.y;

      this.targets.forEach((target, index) => {
        const parentWorld = target.parent?.worldTransform ?? new Matrix();
        const localStart = parentWorld.applyInverse(state.pointerStart);
        const localEnd = parentWorld.applyInverse(new Point(state.pointerStart.x + dx, state.pointerStart.y + dy));

        target.position.set(
          state.startPositions[index].x + localEnd.x - localStart.x,
          state.startPositions[index].y + localEnd.y - localStart.y,
        );
        target.updateLocalTransform();
      });
      return;
    }

    if (state.mode === 'rotate') {
      const deltaRotation = nextBox.rotation - state.startBox.rotation;
      const center = getBoxCenter(state.startBox);

      this.targets.forEach((target, index) => {
        const startWorld = state.startWorldMatrices[index];
        const targetOrigin = new Point(startWorld.tx, startWorld.ty);
        const rotatedOrigin = rotatePoint(targetOrigin, center, deltaRotation);
        const world = rotateMatrixLinear(startWorld, deltaRotation);
        world.tx = rotatedOrigin.x;
        world.ty = rotatedOrigin.y;
        setWorldMatrix(target, world);
      });
      return;
    }

    const contentNextBox = contentBoxFromVisualBox(nextBox, this.options.padding);
    const delta = multiplyMatrices(boxToMatrix(contentNextBox), invertMatrix(boxToMatrix(state.startContentBox)));

    this.targets.forEach((target, index) => {
      const world = multiplyMatrices(delta, state.startWorldMatrices[index]);
      setWorldMatrix(target, world);
    });
  }

  private computeBox(padding = this.options.padding): TransformerBox | null {
    if (this.targets.length === 0) {
      return null;
    }

    const rects = this.targets.map((target) => getWorldRect(target));
    const minX = Math.min(...rects.map((rect) => rect.x));
    const minY = Math.min(...rects.map((rect) => rect.y));
    const maxX = Math.max(...rects.map((rect) => rect.x + rect.width));
    const maxY = Math.max(...rects.map((rect) => rect.y + rect.height));
    if (this.targets.length === 1 && this.options.useSingleNodeRotation) {
      return getSingleTargetBox(this.targets[0], padding);
    }

    return {
      x: minX - padding,
      y: minY - padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
      rotation: 0,
    };
  }
}

function getSingleTargetBox(target: Container, padding: number): TransformerBox {
  updateTargetTransform(target);

  const local = getLocalRect(target);
  const world = getWorldMatrix(target);
  const topLeft = world.apply(new Point(local.x, local.y));
  const topRight = world.apply(new Point(local.x + local.width, local.y));
  const bottomRight = world.apply(new Point(local.x + local.width, local.y + local.height));
  const bottomLeft = world.apply(new Point(local.x, local.y + local.height));
  const ordered = orderQuadPoints([topLeft, topRight, bottomRight, bottomLeft]);
  const [boxTopLeft, boxTopRight, boxBottomRight, boxBottomLeft] = ordered;
  const candidates: Array<{
    topLeft: Point;
    widthVector: Point;
    heightVector: Point;
  }> = [
    {
      topLeft: boxTopLeft,
      widthVector: sub(boxTopRight, boxTopLeft),
      heightVector: sub(boxBottomLeft, boxTopLeft),
    },
    {
      topLeft: boxTopRight,
      widthVector: sub(boxBottomRight, boxTopRight),
      heightVector: sub(boxTopLeft, boxTopRight),
    },
  ];
  const candidate = candidates.reduce((best, item) =>
    Math.hypot(item.widthVector.x, item.widthVector.y) >= Math.hypot(best.widthVector.x, best.widthVector.y)
      ? item
      : best,
  );
  const topLeftPoint = candidate.topLeft;
  const widthVector = candidate.widthVector;
  const heightVector = candidate.heightVector;
  const width = Math.hypot(widthVector.x, widthVector.y);
  const rotation = Math.atan2(widthVector.y, widthVector.x);
  const xAxis = unitX(rotation);
  const yAxis = unitY(rotation);
  const signedHeight = dot(heightVector, yAxis);
  const heightSign = Math.sign(signedHeight || 1);

  return {
    x: topLeftPoint.x - xAxis.x * padding - yAxis.x * padding * heightSign,
    y: topLeftPoint.y - xAxis.y * padding - yAxis.y * padding * heightSign,
    width: width + padding * 2,
    height: signedHeight + heightSign * padding * 2,
    rotation,
  };
}

function getLocalRect(target: Container): Rectangle {
  const bounds = target.getLocalBounds() as unknown as Rectangle & {
    minX?: number;
    minY?: number;
    maxX?: number;
    maxY?: number;
  };

  if (typeof bounds.x === 'number') {
    return new Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  return new Rectangle(
    bounds.minX ?? 0,
    bounds.minY ?? 0,
    (bounds.maxX ?? 0) - (bounds.minX ?? 0),
    (bounds.maxY ?? 0) - (bounds.minY ?? 0),
  );
}

function getWorldRect(target: Container): Rectangle {
  const local = getLocalRect(target);
  const world = getWorldMatrix(target);
  const points = [
    world.apply(new Point(local.x, local.y)),
    world.apply(new Point(local.x + local.width, local.y)),
    world.apply(new Point(local.x + local.width, local.y + local.height)),
    world.apply(new Point(local.x, local.y + local.height)),
  ];
  const minX = Math.min(...points.map((point) => point.x));
  const minY = Math.min(...points.map((point) => point.y));
  const maxX = Math.max(...points.map((point) => point.x));
  const maxY = Math.max(...points.map((point) => point.y));

  return new Rectangle(minX, minY, maxX - minX, maxY - minY);
}

function updateTargetTransform(target: Container): void {
  target.updateLocalTransform();
}

function getWorldMatrix(target: Container): Matrix {
  const chain: Container[] = [];
  let current: Container | null = target;

  while (current) {
    chain.unshift(current);
    current = current.parent;
  }

  return chain.reduce((matrix, container) => {
    container.updateLocalTransform();
    return multiplyMatrices(matrix, container.localTransform);
  }, new Matrix());
}

function setWorldMatrix(target: Container, world: Matrix): void {
  const parentWorld = target.parent ? getWorldMatrix(target.parent) : new Matrix();
  const local = multiplyMatrices(invertMatrix(parentWorld), world);
  applyLocalMatrix(target, local);
}

function applyLocalMatrix(target: Container, matrix: Matrix): void {
  const targetWithSetter = target as Container & {
    setFromMatrix?: (matrix: Matrix) => void;
  };

  if (targetWithSetter.setFromMatrix) {
    targetWithSetter.setFromMatrix(matrix);
    return;
  }

  const scaleX = Math.hypot(matrix.a, matrix.b);
  const det = matrix.a * matrix.d - matrix.b * matrix.c;
  const scaleY = scaleX > EPSILON ? det / scaleX : Math.hypot(matrix.c, matrix.d);
  const rotation = Math.atan2(matrix.b, matrix.a);

  target.position.set(matrix.tx, matrix.ty);
  target.scale.set(scaleX, scaleY);
  target.rotation = rotation;
}

function rotateMatrixLinear(matrix: Matrix, rotation: number): Matrix {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  return new Matrix(
    cos * matrix.a - sin * matrix.b,
    sin * matrix.a + cos * matrix.b,
    cos * matrix.c - sin * matrix.d,
    sin * matrix.c + cos * matrix.d,
    matrix.tx,
    matrix.ty,
  );
}

function boxToMatrix(box: TransformerBox): Matrix {
  const cos = Math.cos(box.rotation);
  const sin = Math.sin(box.rotation);
  return new Matrix(cos * box.width, sin * box.width, -sin * box.height, cos * box.height, box.x, box.y);
}

function contentBoxFromVisualBox(box: TransformerBox, padding: number): TransformerBox {
  if (padding === 0) {
    return box;
  }

  const xAxis = unitX(box.rotation);
  const yAxis = unitY(box.rotation);
  const widthSign = Math.sign(box.width || 1);
  const heightSign = Math.sign(box.height || 1);

  return {
    x: box.x + xAxis.x * padding * widthSign + yAxis.x * padding * heightSign,
    y: box.y + xAxis.y * padding * widthSign + yAxis.y * padding * heightSign,
    width: box.width - padding * 2 * widthSign,
    height: box.height - padding * 2 * heightSign,
    rotation: box.rotation,
  };
}

function multiplyMatrices(left: Matrix, right: Matrix): Matrix {
  return new Matrix(
    left.a * right.a + left.c * right.b,
    left.b * right.a + left.d * right.b,
    left.a * right.c + left.c * right.d,
    left.b * right.c + left.d * right.d,
    left.a * right.tx + left.c * right.ty + left.tx,
    left.b * right.tx + left.d * right.ty + left.ty,
  );
}

function invertMatrix(matrix: Matrix): Matrix {
  const det = matrix.a * matrix.d - matrix.b * matrix.c;
  if (Math.abs(det) < EPSILON) {
    return new Matrix();
  }

  const id = 1 / det;
  return new Matrix(
    matrix.d * id,
    -matrix.b * id,
    -matrix.c * id,
    matrix.a * id,
    (matrix.c * matrix.ty - matrix.d * matrix.tx) * id,
    (matrix.b * matrix.tx - matrix.a * matrix.ty) * id,
  );
}

function getBoxCorners(box: TransformerBox): [Point, Point, Point, Point] {
  const xAxis = unitX(box.rotation);
  const yAxis = unitY(box.rotation);
  const topLeft = new Point(box.x, box.y);
  const topRight = add(topLeft, mul(xAxis, box.width));
  const bottomRight = add(topRight, mul(yAxis, box.height));
  const bottomLeft = add(topLeft, mul(yAxis, box.height));
  return [topLeft, topRight, bottomRight, bottomLeft];
}

function getBoxCenter(box: TransformerBox): Point {
  const corners = getBoxCorners(box);
  return midpoint(corners[0], corners[2]);
}

function orderQuadPoints(points: [Point, Point, Point, Point]): [Point, Point, Point, Point] {
  const center = new Point(
    points.reduce((sum, point) => sum + point.x, 0) / points.length,
    points.reduce((sum, point) => sum + point.y, 0) / points.length,
  );
  const sorted = [...points].sort(
    (a, b) => Math.atan2(a.y - center.y, a.x - center.x) - Math.atan2(b.y - center.y, b.x - center.x),
  );
  const topStart = sorted.reduce((bestIndex, point, index) => {
    const best = sorted[bestIndex];
    if (point.y < best.y - EPSILON || (Math.abs(point.y - best.y) < EPSILON && point.x < best.x)) {
      return index;
    }

    return bestIndex;
  }, 0);
  const rotated = [...sorted.slice(topStart), ...sorted.slice(0, topStart)];

  return [rotated[0], rotated[1], rotated[2], rotated[3]];
}

function boxFromCenter(center: Point, width: number, height: number, rotation: number): TransformerBox {
  const xAxis = unitX(rotation);
  const yAxis = unitY(rotation);

  return {
    x: center.x - (xAxis.x * width + yAxis.x * height) / 2,
    y: center.y - (xAxis.y * width + yAxis.y * height) / 2,
    width,
    height,
    rotation,
  };
}

function unitX(rotation: number): Point {
  return new Point(Math.cos(rotation), Math.sin(rotation));
}

function unitY(rotation: number): Point {
  return new Point(-Math.sin(rotation), Math.cos(rotation));
}

function midpoint(a: Point, b: Point): Point {
  return new Point((a.x + b.x) / 2, (a.y + b.y) / 2);
}

function add(a: Point, b: Point): Point {
  return new Point(a.x + b.x, a.y + b.y);
}

function sub(a: Point, b: Point): Point {
  return new Point(a.x - b.x, a.y - b.y);
}

function mul(point: Point, value: number): Point {
  return new Point(point.x * value, point.y * value);
}

function normalize(point: Point): Point {
  const length = Math.hypot(point.x, point.y);
  if (length < EPSILON) {
    return new Point(0, 1);
  }

  return new Point(point.x / length, point.y / length);
}

function dot(a: Point, b: Point): number {
  return a.x * b.x + a.y * b.y;
}

function rotatePoint(point: Point, center: Point, rotation: number): Point {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return new Point(center.x + dx * cos - dy * sin, center.y + dx * sin + dy * cos);
}

function isPrimaryButtonReleased(event: FederatedPointerEvent): boolean {
  const eventWithButtons = event as FederatedPointerEvent & { buttons?: number };
  return typeof eventWithButtons.buttons === 'number' && eventWithButtons.buttons === 0;
}
