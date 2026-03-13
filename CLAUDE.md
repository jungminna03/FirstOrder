# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server at http://localhost:5173
npm run build     # Production build to dist/
npm run preview   # Preview the production build locally
npm run android   # Build + copy to Capacitor + open Android Studio
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

## Coding Style

- **항상 Edit(diff) 방식으로 파일 수정** — 완전 재작성이 필요한 경우에만 Write 사용.

## Agent Team

See [`docs/AGENT_TEAM.md`](docs/AGENT_TEAM.md) for the full agent team structure (roles, workflow, rules).

**모든 작업은 반드시 아래 팀 워크플로우를 따른다:**

1. **Researcher** — 새 시스템·콘텐츠 기획이 포함된 경우 먼저 레퍼런스/아이디어를 수집하고 사용자에게 공유한다.
2. **Architect** — 작업 시작 전 구조/기능 설계를 수립하고 사용자에게 확인받는다.
3. **Level Designer** — 게임 밸런스·레벨·카드/퍽 변경이 포함된 경우 반드시 참여한다.
4. **Coder** — 확인된 설계를 바탕으로 구현한다.
5. **Reviewer** — 구현 완료 후 코드 품질·중복·단순화 관점에서 검토한다.
6. **Docs** — 메커니즘·레벨 데이터가 변경된 경우 `MECHANICS.md`, `LEVELDESIGN.md`, `CLAUDE.md`를 갱신한다.

단순 질문·조회성 작업(파일 읽기, 설명 요청 등)은 워크플로우를 생략한다.

## Project Specification

See [`docs/MECHANICS.md`](docs/MECHANICS.md) for the full game mechanics spec (scenes, paddle, ball, bricks, scoring, lives, pause system, end states, controls). Update that file whenever mechanics change.
See [`docs/LEVELDESIGN.md`](docs/LEVELDESIGN.md) for wave, card/perk balance, and difficulty design. Update that file whenever level or balance changes.

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
