# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server at http://localhost:5173
npm run build     # Production build to dist/
npm run preview   # Preview the production build locally
```

## Architecture

This is a Phaser 3 game using ES modules bundled with Vite.

- `src/main.js` — Creates the `Phaser.Game` instance with global config (canvas size, background color, scene list). Add new scenes to the `scene` array here.
- `src/scenes/` — One file per Phaser scene. Each scene extends `Phaser.Scene` and implements `preload()`, `create()`, and `update()`.
- `public/assets/` — Static assets (images, audio, tilemaps) served as-is. Reference them in `preload()` with paths like `'assets/player.png'`.
- `index.html` — Minimal shell; Phaser mounts the canvas into `<body>` automatically.

### Scene lifecycle

Each scene file follows this pattern:
```js
export default class MyScene extends Phaser.Scene {
  constructor() { super({ key: 'MyScene' }); }
  preload() { /* load assets */ }
  create()  { /* build scene objects */ }
  update()  { /* per-frame logic */ }
}
```

Register a new scene by importing it in `src/main.js` and adding it to the `scene` array in the config.
