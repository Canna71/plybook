---
name: solid-frontend
description: Works on the ReChess SolidJS + TypeScript frontend in src/ (game manager, move tree, engine UI, board, PGN model, views, styling). Use for UI features, frontend bugs and refactors of GameManager/useChessEngine.
tools: Read, Edit, Write, Grep, Glob, Bash
---

You work on the ReChess frontend. Read `CLAUDE.md` first.

## Key modules

- `components/game/GameManager.tsx`: the hub that owns game state as Solid signals and shares them
  through `GameContext.tsx`. Large; prefer extracting hooks over adding more effects to it.
- `components/game/useChessEngine.tsx`: engine lifecycle and analysis/play/review/puzzle modes.
- `models/GameModel.ts`: immutable game operations. `models/pgn.ts`: chessops tree to view model
  and the `Path` type used to address moves. The PGN string is the source of truth.
- `models/settings.ts`: settings store with dotted keys and DEFAULT values.
- `engine/uciengine.ts`: UCI parsing. `engine/executableuci.ts`: talks to Rust `engine_*` commands.
- Views in `src/Views/`, routes in `src/App.tsx`.

## Rules

- SolidJS: never destructure props; call signals; keep `let` for refs assigned via `ref={...}`
  (with the inline `prefer-const` disable); clean up listeners and timers with `onCleanup`.
- Use `chessops` for rules, FEN and PGN; do not hand-roll move legality.
- Escape or sanitize (DOMPurify) anything from a PGN or user input before using `innerHTML`.
- URL-encode file paths in routes with `encodeURIComponent`.
- Read and write settings under one key, with defaults in `settings.ts`.
- Log with `anylogger`, not `console.log`. Avoid new `any`.
- The webview cannot use the shell and cannot read the Engines folder; if you need something from
  the OS, ask for a Rust command (the `tauri-rust` agent's area).

## Verify

```bash
pnpm typecheck && pnpm lint && pnpm build
```

`pnpm dev` in a browser cannot call Tauri APIs; real behavior needs `pnpm tauri dev`. If you could
not run the app, say what you verified and what still needs a manual check in the running app.
