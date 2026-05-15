import './demo.css';
import { Application, Container, FederatedPointerEvent, Graphics, Point, Rectangle } from 'pixi.js';
import { PixiTransformer } from './PixiTransformer';

const stageHost = getElement<HTMLElement>('#stage');
const codeView = getElement<HTMLElement>('#codeView');
const openSandboxButton = getElement<HTMLButtonElement>('#openSandbox');
const fileTabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.tab'));
const exampleTabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.example-tab'));
const sandboxUrl = 'https://codesandbox.io/p/github/q1998763/pixi-transformer/main?file=%2Fsrc%2Fdemo.ts';
type DemoExample = 'basic' | 'styling';

let activeExample: DemoExample = 'basic';
let activeFileName = 'src/main.ts';

const sharedIndexHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pixi Transformer Demo</title>
    <script type="module" src="/src/demo.ts"></script>
  </head>
  <body>
    <div id="app">
      <div id="stage"></div>
    </div>
  </body>
</html>`;

const sampleFiles: Record<DemoExample, Record<string, string>> = {
  basic: {
    'index.html': sharedIndexHtml,
    'src/main.ts': `import { Application, Container, Graphics } from 'pixi.js';
import { PixiTransformer } from '@q1998763/pixi-transformer';

const host = document.querySelector('#stage') as HTMLElement;
const app = new Application();
await app.init({
  resizeTo: host,
  antialias: true,
  background: '#ffffff',
});

host.appendChild(app.canvas);

const targets = [
  createShape(180, 145, 170, 96, 0x38bdf8, -0.12),
  createShape(460, 180, 190, 112, 0xf59e0b, 0.18),
  createShape(330, 390, 132, 132, 0xa78bfa, -0.28),
];

const transformer = new PixiTransformer({
  nodes: [targets[0]],
  anchorSize: 12,
  borderStroke: 0x7dd3fc,
  anchorStroke: 0x7dd3fc,
  anchorFill: 0x0f172a,
  rotateAnchorOffset: 44,
});

for (const target of targets) {
  app.stage.addChild(target);
  target.on('pointerdown', (event) => {
    event.stopPropagation();
    transformer.nodes(event.shiftKey ? targets : [target]);
  });
}

app.stage.addChild(transformer);

function createShape(
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  rotation: number,
): Container {
  const shape = new Graphics();
  shape.roundRect(0, 0, width, height, 8).fill(color);
  shape.position.set(x, y);
  shape.rotation = rotation;
  shape.eventMode = 'static';
  shape.cursor = 'pointer';
  return shape;
}`,
  },
  styling: {
    'index.html': sharedIndexHtml,
    'src/main.ts': `import { Application, Graphics } from 'pixi.js';
import { PixiTransformer } from '@q1998763/pixi-transformer';

const host = document.querySelector('#stage') as HTMLElement;
const app = new Application();
await app.init({
  resizeTo: host,
  antialias: true,
  background: '#ffffff',
});

host.appendChild(app.canvas);

const rect = new Graphics();
rect.rect(0, 0, 100, 90).fill(0xffe500);
rect.position.set(260, 160);
rect.rotation = 0.18;
rect.eventMode = 'static';
rect.cursor = 'pointer';
app.stage.addChild(rect);

const transformer = new PixiTransformer({
  nodes: [rect],
  borderStroke: 0x000000,
  borderStrokeWidth: 4,
  anchorFill: 0xffffff,
  anchorStroke: 0x000000,
  anchorStrokeWidth: 4,
  anchorSize: 20,
  anchorCornerRadius: 50,
  rotateAnchorOffset: 58,
});

app.stage.addChild(transformer);

rect.on('pointerdown', (event) => {
  event.stopPropagation();
  transformer.nodes([rect]);
});`,
  },
};

const app = new Application();
const world = new Container();
const grid = new Graphics();
const selection: Container[] = [];
let targets: Container[] = [];
let targetDragState: {
  pointerStart: Point;
  startPositions: Point[];
  startTransformerBox: ReturnType<PixiTransformer['getBox']>;
} | null = null;
const transformer = new PixiTransformer({
  anchorSize: 12,
  borderStroke: 0x7dd3fc,
  anchorStroke: 0x7dd3fc,
  anchorFill: 0x0f172a,
  // padding: 8,
  rotateAnchorOffset: 44,
});

main().catch((error: unknown) => {
  console.error(error);
});

async function main(): Promise<void> {
  renderCode(activeFileName);

  await app.init({
    resizeTo: stageHost,
    antialias: true,
    background: '#ffffff',
  });

  stageHost.appendChild(app.canvas);
  app.stage.eventMode = 'static';
  app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);
  app.stage.addChild(world);

  app.stage.on('pointerdown', () => {
    selectTargets([]);
  });
  app.stage.on('globalpointermove', onStagePointerMove);
  app.stage.on('pointerup', endTargetDrag);
  app.stage.on('pointerupoutside', endTargetDrag);
  app.stage.on('globalpointerup', endTargetDrag);
  app.stage.on('globalpointerupoutside', endTargetDrag);
  window.addEventListener('pointerup', endTargetDrag);
  window.addEventListener('blur', endTargetDrag);

  openSandboxButton.addEventListener('click', () => {
    window.open(sandboxUrl, '_blank', 'noopener,noreferrer');
  });

  for (const tab of fileTabs) {
    tab.addEventListener('click', () => {
      const fileName = tab.dataset.file;

      if (fileName) {
        activeFileName = fileName;
        renderCode(fileName);
      }
    });
  }

  for (const tab of exampleTabs) {
    tab.addEventListener('click', () => {
      const example = tab.dataset.example as DemoExample | undefined;

      if (example) {
        showExample(example);
      }
    });
  }

  showExample(activeExample);

  app.ticker.add(() => {
    app.stage.hitArea = new Rectangle(0, 0, app.screen.width, app.screen.height);
    drawGrid();
  });
}

function showExample(example: DemoExample): void {
  activeExample = example;
  activeFileName = 'src/main.ts';
  renderCode(activeFileName);
  resetScene(example);

  for (const tab of exampleTabs) {
    tab.classList.toggle('is-active', tab.dataset.example === example);
  }
}

function resetScene(example: DemoExample): void {
  targetDragState = null;
  selection.length = 0;
  transformer.detach();
  world.removeChildren();
  world.addChild(grid);
  targets = example === 'styling' ? createStylingTargets() : createBasicTargets();
  applyExampleTransformerOptions(example);

  for (const target of targets) {
    world.addChild(target);
    target.on('pointerdown', (event) => {
      event.stopPropagation();
      if (event.shiftKey) {
        selectTargets(toggleSelection(target));
      } else if (!selection.includes(target)) {
        selectTargets([target]);
      }
      beginTargetDrag(event);
    });
  }

  world.addChild(transformer);
  selectTargets([targets[0]]);
}

function applyExampleTransformerOptions(example: DemoExample): void {
  Object.assign(
    transformer.options,
    example === 'styling'
      ? {
          anchorSize: 20,
          anchorCornerRadius: 50,
          anchorFill: 0xffffff,
          anchorStroke: 0x000000,
          anchorStrokeWidth: 4,
          borderStroke: 0x000000,
          borderStrokeWidth: 4,
          rotateAnchorOffset: 58,
          padding: 0,
        }
      : {
          anchorSize: 12,
          anchorCornerRadius: 0,
          anchorFill: 0x0f172a,
          anchorStroke: 0x7dd3fc,
          anchorStrokeWidth: 2,
          borderStroke: 0x7dd3fc,
          borderStrokeWidth: 1.5,
          rotateAnchorOffset: 44,
          padding: 0,
        },
  );
}

function renderCode(fileName: string): void {
  codeView.innerHTML = highlightCode(sampleFiles[activeExample][fileName] ?? '', fileName);

  for (const tab of fileTabs) {
    tab.classList.toggle('is-active', tab.dataset.file === fileName);
  }
}

function highlightCode(source: string, fileName: string): string {
  return source
    .split('\n')
    .map((line) => highlightLine(line, fileName.endsWith('.html') ? 'html' : 'ts'))
    .join('\n');
}

function highlightLine(line: string, language: 'html' | 'ts'): string {
  const tokens =
    language === 'html'
      ? /(&lt;\/?[\w-]+|\/?&gt;|[\w-]+(?==)|"[^"]*"|'[^']*'|&lt;!doctype html&gt;)/gi
      : /(\/\/.*$|`[^`]*`|"[^"]*"|'[^']*'|\b(?:await|const|for|from|function|import|new|return|true|type)\b|\b(?:Application|Container|Graphics|PixiTransformer|HTMLElement)\b|\b\d+(?:\.\d+)?\b)/g;

  return escapeHtml(line).replace(tokens, (token) => {
    if (/^\/\//.test(token)) {
      return wrapToken(token, 'comment');
    }

    if (/^['"`]/.test(token) || /^&quot;/.test(token)) {
      return wrapToken(token, 'string');
    }

    if (/^\d/.test(token)) {
      return wrapToken(token, 'number');
    }

    if (/^(&lt;|\/?&gt;)/.test(token)) {
      return wrapToken(token, 'tag');
    }

    if (/^(Application|Container|Graphics|PixiTransformer|HTMLElement)$/.test(token)) {
      return wrapToken(token, 'type');
    }

    if (language === 'html' && /^[\w-]+$/.test(token)) {
      return wrapToken(token, 'attr');
    }

    return wrapToken(token, 'keyword');
  });
}

function wrapToken(token: string, type: string): string {
  return `<span class="token-${type}">${token}</span>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Demo DOM is missing ${selector}.`);
  }

  return element;
}

function beginTargetDrag(event: FederatedPointerEvent): void {
  if (selection.length === 0) {
    return;
  }

  targetDragState = {
    pointerStart: event.global.clone(),
    startPositions: selection.map((target) => target.position.clone()),
    startTransformerBox: transformer.getBox(),
  };
}

function onStagePointerMove(event: FederatedPointerEvent): void {
  if (!targetDragState) {
    return;
  }

  if (isPrimaryButtonReleased(event)) {
    endTargetDrag();
    return;
  }

  const dx = event.global.x - targetDragState.pointerStart.x;
  const dy = event.global.y - targetDragState.pointerStart.y;

  selection.forEach((target, index) => {
    target.position.set(
      targetDragState!.startPositions[index].x + dx,
      targetDragState!.startPositions[index].y + dy,
    );
  });

  if (targetDragState.startTransformerBox) {
    transformer.setBox({
      ...targetDragState.startTransformerBox,
      x: targetDragState.startTransformerBox.x + dx,
      y: targetDragState.startTransformerBox.y + dy,
    });
  } else {
    transformer.update();
  }
}

function endTargetDrag(): void {
  if (!targetDragState) {
    return;
  }

  targetDragState = null;
}

function isPrimaryButtonReleased(event: FederatedPointerEvent): boolean {
  const eventWithButtons = event as FederatedPointerEvent & { buttons?: number };
  return typeof eventWithButtons.buttons === 'number' && eventWithButtons.buttons === 0;
}

function selectTargets(nextSelection: Container[]): void {
  selection.length = 0;
  selection.push(...nextSelection);
  transformer.nodes(selection);

  for (const target of targets) {
    target.alpha = selection.includes(target) ? 1 : 0.72;
  }
}

function toggleSelection(target: Container): Container[] {
  if (selection.includes(target)) {
    return selection.filter((item) => item !== target);
  }

  return [...selection, target];
}

function createBasicTargets(): Container[] {
  return [
    createCard(180, 145, 170, 96, 0x38bdf8, 0x0f766e, -0.12),
    createTicket(460, 180, 190, 112, 0xf59e0b, 0x7c2d12, 0.18),
    createBadge(330, 390, 132, 132, 0xa78bfa, 0x4338ca, -0.28),
  ];
}

function createStylingTargets(): Container[] {
  const rect = new Graphics();
  rect.rect(0, 0, 100, 90).fill(0xffe500);
  return [makeTarget(rect, 300, 190, 0.18)];
}

function createCard(
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  shadow: number,
  rotation: number,
): Container {
  const card = new Graphics();
  card.roundRect(0, 0, width, height, 8).fill(color);
  card.roundRect(14, 18, width - 28, 16, 5).fill(0xffffff, 0.45);
  card.roundRect(14, 48, width * 0.52, 12, 5).fill(shadow, 0.55);
  card.roundRect(14, 70, width * 0.72, 10, 5).fill(0xffffff, 0.35);
  return makeTarget(card, x, y, rotation);
}

function createTicket(
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  shadow: number,
  rotation: number,
): Container {
  const ticket = new Graphics();
  ticket.roundRect(0, 0, width, height, 8).fill(color);
  ticket.circle(0, height / 2, 17).cut();
  ticket.circle(width, height / 2, 17).cut();
  ticket.rect(width * 0.62, 16, 2, height - 32).fill(shadow, 0.5);
  ticket.circle(44, 46, 20).fill(0xffffff, 0.42);
  ticket.roundRect(78, 36, 68, 12, 4).fill(0xffffff, 0.42);
  ticket.roundRect(78, 58, 46, 10, 4).fill(shadow, 0.5);
  return makeTarget(ticket, x, y, rotation);
}

function createBadge(
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
  shadow: number,
  rotation: number,
): Container {
  const badge = new Graphics();
  badge.circle(width / 2, height / 2, width / 2).fill(color);
  badge.circle(width / 2, height / 2, width / 2 - 16).stroke({ color: 0xffffff, width: 4, alpha: 0.5 });
  badge.star(width / 2, height / 2, 5, 36, 16).fill(shadow, 0.76);
  return makeTarget(badge, x, y, rotation);
}

function makeTarget(graphic: Graphics, x: number, y: number, rotation: number): Graphics {
  graphic.position.set(x, y);
  graphic.rotation = rotation;
  graphic.eventMode = 'static';
  graphic.cursor = 'pointer';
  graphic.hitArea = new Rectangle(0, 0, graphic.width, graphic.height);
  return graphic;
}

function drawGrid(): void {
  const width = app.screen.width;
  const height = app.screen.height;
  const step = 32;

  grid.clear();

  for (let x = 0; x <= width; x += step) {
    grid.moveTo(x, 0).lineTo(x, height);
  }

  for (let y = 0; y <= height; y += step) {
    grid.moveTo(0, y).lineTo(width, y);
  }

  grid.stroke({ color: 0x94a3b8, width: 1, alpha: 0.12 });

  const origin = new Point(24, 24);
  grid.circle(origin.x, origin.y, 4).fill(0x2563eb, 0.72);
}
