# @q1998763/pixi-transformer

Konva-style transform controls for PixiJS v8.

`@q1998763/pixi-transformer` gives Pixi display objects an editor-like bounding box with resize anchors, a rotate handle, multi-select transforms, centered scaling, keep-ratio scaling, and optional flip support.

It is designed for canvas editors, whiteboards, design tools, image annotation tools, level editors, and any Pixi app where users need to move, scale, rotate, or flip objects directly on the stage.

## Features

- PixiJS v8 support
- Single-object and multi-object selection
- Move, resize, rotate, and flip selected objects
- Eight resize anchors plus a rotate anchor
- Optional `keepRatio`, `centeredScaling`, and `flipEnabled`
- Konva-inspired `boundBoxFunc` hook for transform constraints
- Works with Pixi `Container`, `Graphics`, `Sprite`, and other display objects
- TypeScript declarations

## Install

```bash
npm install @q1998763/pixi-transformer pixi.js
```

Pixi is a peer dependency, so your app controls the Pixi version.

## Quick Start

```ts
import { Application, Sprite } from 'pixi.js';
import { PixiTransformer } from '@q1998763/pixi-transformer';

const app = new Application();
await app.init({ resizeTo: window, background: '#202124' });
document.body.appendChild(app.canvas);

const sprite = Sprite.from('/image.png');
sprite.eventMode = 'static';
sprite.position.set(200, 160);
app.stage.addChild(sprite);

const transformer = new PixiTransformer({
  nodes: [sprite],
  rotateEnabled: true,
  keepRatio: false,
});

app.stage.addChild(transformer);
```

## Demo

Clone the repo and run:

```bash
npm install
npm run dev
```

Then open:

```text
http://127.0.0.1:5173/
```

The demo includes single select, multi-select, rotation, resize, centered scaling, keep-ratio scaling, and flipping.

## Basic Usage

Attach the transformer to one or more Pixi containers:

```ts
transformer.nodes([sprite]);
transformer.nodes([spriteA, spriteB, spriteC]);
```

Detach it:

```ts
transformer.detach();
```

Refresh the selection box after you change target objects outside the transformer:

```ts
transformer.update();
```

## Transform Constraints

Use `boundBoxFunc` to constrain the new box before it is applied:

```ts
const transformer = new PixiTransformer({
  nodes: [sprite],
  boundBoxFunc: (oldBox, newBox) => {
    if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20) {
      return oldBox;
    }

    return newBox;
  },
});
```

This mirrors the shape of Konva's Transformer API while staying Pixi-native.

## Options

```ts
new PixiTransformer({
  nodes,
  enabledAnchors,
  resizeEnabled,
  rotateEnabled,
  rotateAnchorOffset,
  padding,
  anchorSize,
  anchorCornerRadius,
  anchorFill,
  anchorStroke,
  anchorStrokeWidth,
  borderStroke,
  borderStrokeWidth,
  keepRatio,
  centeredScaling,
  flipEnabled,
  useSingleNodeRotation,
  boundBoxFunc,
});
```

See [API.md](./API.md) for the full option reference.

## How It Works

The transformer keeps a selection box in world space. During resize, it computes a delta matrix from the old selection box to the new selection box and applies that delta to each selected target. This follows the same practical model as Konva Transformer: object geometry is not rewritten; object transforms are updated.

For single nodes, the transformer reads the object's local bounds and world matrix to rebuild a rotated selection box. For multiple nodes, the transformer uses a shared selection box and applies one transform delta to every selected node, preserving group-relative placement.

## Current Scope

This project is intentionally small and focused. It does not try to replace a full editor framework.

Good fits:

- Canvas/design editors
- Image annotation surfaces
- Whiteboards
- Simple layout tools
- Pixi-based game editors

Things you may need to extend for a production editor:

- snapping
- selection marquee
- keyboard transforms
- history/undo integration
- custom anchor rendering
- constraints per target type

## Development

```bash
npm install
npm run build
npm run dev
```

Build the demo:

```bash
npm run demo:build
```

## License

MIT
