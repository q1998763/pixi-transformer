# Contributing

Thanks for helping improve `@q1998763/pixi-transformer`.

## Local Setup

```bash
npm install
npm run dev
```

Run type checks:

```bash
npm run build
```

Build the demo:

```bash
npm run demo:build
```

## Development Notes

- Keep the public API small and Pixi-native.
- Prefer matrix-based transforms for group behavior.
- Test single selection after group resize, rotate, flip, and centered scaling changes.
- Avoid adding editor-specific features unless they are broadly useful.
- Keep demo code separate from the library entry point.

## Pull Requests

Before opening a pull request:

- run `npm run build`
- run `npm run demo:build`
- describe the interaction scenario you changed
- include screenshots or short recordings for visual behavior changes when possible
