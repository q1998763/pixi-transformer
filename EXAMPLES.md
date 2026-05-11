# Examples

## Single Selection

```ts
const transformer = new PixiTransformer();
app.stage.addChild(transformer);

sprite.eventMode = 'static';
sprite.on('pointerdown', () => {
  transformer.nodes([sprite]);
});
```

## Multi Selection

```ts
transformer.nodes([spriteA, spriteB, spriteC]);
```

Multi-selection transforms are applied with one shared selection-box delta matrix, so objects keep their relative placement within the selection.

## Keep Ratio

```ts
const transformer = new PixiTransformer({
  nodes: [sprite],
  keepRatio: true,
});
```

Corner resizing preserves the selected box ratio.

## Centered Scaling

```ts
const transformer = new PixiTransformer({
  nodes: [sprite],
  centeredScaling: true,
});
```

Resizing expands or shrinks around the selection center.

## Disable Flip

```ts
const transformer = new PixiTransformer({
  nodes: [sprite],
  flipEnabled: false,
});
```

When disabled, the transformer prevents width or height from crossing zero.

## Minimum Size Constraint

```ts
const transformer = new PixiTransformer({
  boundBoxFunc: (oldBox, newBox) => {
    const minSize = 24;

    if (Math.abs(newBox.width) < minSize || Math.abs(newBox.height) < minSize) {
      return oldBox;
    }

    return newBox;
  },
});
```

## Drag Selected Nodes Yourself

If your app handles object dragging outside the transformer, keep the transformer in sync.

```ts
const startBox = transformer.getBox();

// after moving selected nodes by dx/dy
if (startBox) {
  transformer.setBox({
    ...startBox,
    x: startBox.x + dx,
    y: startBox.y + dy,
  });
} else {
  transformer.update();
}
```

Use `update()` when you want the transformer to recompute from target bounds.
