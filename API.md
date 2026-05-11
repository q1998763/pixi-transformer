# API

## `PixiTransformer`

```ts
import { PixiTransformer } from 'pixi-transformer';
```

`PixiTransformer` extends Pixi's `Container`, so add it to the same scene graph as your editable objects.

```ts
const transformer = new PixiTransformer(options);
app.stage.addChild(transformer);
```

## Constructor Options

### `nodes?: Container[]`

Initial target nodes.

```ts
new PixiTransformer({ nodes: [sprite] });
```

### `enabledAnchors?: TransformerAnchor[]`

Controls which resize anchors are visible.

```ts
type TransformerAnchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-right'
  | 'bottom-right'
  | 'bottom-center'
  | 'bottom-left'
  | 'middle-left'
  | 'rotater';
```

Default resize anchors:

```ts
[
  'top-left',
  'top-center',
  'top-right',
  'middle-right',
  'bottom-right',
  'bottom-center',
  'bottom-left',
  'middle-left',
]
```

### `resizeEnabled?: boolean`

Enables resize anchors.

Default: `true`

### `rotateEnabled?: boolean`

Enables the rotate anchor.

Default: `true`

### `rotateAnchorOffset?: number`

Distance from the box edge to the rotate anchor.

Default: `38`

### `padding?: number`

Visual spacing between the target bounds and transformer border.

Default: `0`

### `anchorSize?: number`

Resize anchor size in pixels.

Default: `10`

### `anchorFill?: number`

Anchor fill color.

Default: `0xffffff`

### `anchorStroke?: number`

Anchor stroke color.

Default: `0x1a73e8`

### `anchorStrokeWidth?: number`

Anchor stroke width.

Default: `2`

### `borderStroke?: number`

Transformer border color.

Default: `0x1a73e8`

### `borderStrokeWidth?: number`

Transformer border stroke width.

Default: `1.5`

### `keepRatio?: boolean`

Keeps width and height ratio while resizing from corner anchors.

Default: `false`

### `centeredScaling?: boolean`

Scales from the selection center instead of the opposite anchor.

Default: `false`

### `flipEnabled?: boolean`

Allows resizing past zero so selected objects can flip horizontally or vertically.

Default: `true`

### `useSingleNodeRotation?: boolean`

When one target is selected, uses the target's rotation for the transformer box.

Default: `true`

### `boundBoxFunc?: (oldBox, newBox) => TransformerBox`

Called before a resize/move/rotate box is applied. Return `newBox` to accept the transform, return `oldBox` to reject it, or return a modified box to constrain it.

```ts
const transformer = new PixiTransformer({
  boundBoxFunc: (oldBox, newBox) => {
    if (Math.abs(newBox.width) < 16) {
      return oldBox;
    }

    return newBox;
  },
});
```

## Methods

### `nodes(nodes?: Container[]): Container[]`

Gets or sets the selected nodes.

```ts
transformer.nodes([sprite]);
const selected = transformer.nodes();
```

### `attachTo(...nodes: Container[]): this`

Convenience method for attaching nodes.

```ts
transformer.attachTo(spriteA, spriteB);
```

### `detach(): this`

Clears the current selection.

```ts
transformer.detach();
```

### `update(): this`

Recomputes the transformer box from the selected nodes.

Call this after changing selected nodes outside the transformer.

```ts
sprite.rotation += 0.2;
transformer.update();
```

### `getBox(): TransformerBox | null`

Returns a copy of the current transformer box.

### `setBox(box: TransformerBox | null): this`

Sets the current transformer box. This is useful when you move selected nodes externally and want to preserve the transformer's current rotation.

## `TransformerBox`

```ts
interface TransformerBox {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}
```

`x` and `y` are in world coordinates. `rotation` is in radians.
