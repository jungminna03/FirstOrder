# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server at http://localhost:5173
npm run build     # Production build to dist/
npm run preview   # Preview the production build locally
```
## Git Commit Message Rules

Every commit message must start with one of the following tags:

| Tag | When to use |
|---|---|
| `[ADD]` | New feature, file, or asset added |
| `[FIX]` | Bug fix or correction |
| `[UPDATE]` | Enhancement or change to existing feature |
| `[REMOVE]` | Deleted code, file, or feature |
| `[REFACTOR]` | Code restructured without behavior change |
| `[STYLE]` | Formatting, naming, visual tweaks only |
| `[DOCS]` | Documentation or CLAUDE.md changes |
| `[CHORE]` | Config, dependencies, build scripts |

### Format

```
[TAG] Short description (50 chars or less)

Optional longer explanation if needed.
```

### Examples

```
[ADD] Pause menu with Resume and Restart buttons
[FIX] Ball clipping through paddle at high speed
[UPDATE] Increase ball speed each time bricks cleared
[REMOVE] Unused debug overlay from GameScene
[CHORE] Add GitHub Actions deploy workflow
[DOCS] Document GitHub Pages and Vercel deployment
```

## Project Specification

See [`docs/MECHANICS.md`](docs/MECHANICS.md) for the full game mechanics spec (scenes, paddle, ball, bricks, scoring, lives, pause system, end states, controls). Update that file whenever mechanics change.

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

## GitHub

- **Repository:** https://github.com/jungminna03/FirstOrder
- Branch: `master`
- Every push to `master` triggers the GitHub Actions workflow (`.github/workflows/deploy.yml`) which builds the project and deploys it to GitHub Pages.

## Deployment

### GitHub Pages (active)

- **URL:** https://jungminna03.github.io/FirstOrder/
- Deployed automatically via GitHub Actions on every push to `master`.
- `vite.config.js` sets `base: '/FirstOrder/'` so assets resolve correctly under the subpath.

### Vercel (active)

- **URL:** https://firstorder-game.vercel.app
- Linked to the GitHub repo; auto-deploys on every push to `master`.
- The `.vercel` directory is gitignored.
- `vite.config.js` uses `base: '/'` for Vercel (root deployment), and `base: '/FirstOrder/'` only when `GITHUB_ACTIONS=true`.
