# ReChess

Desktop chess study app: play vs engine, analysis, game review, PGN library and puzzles.
**Tauri 2** (Rust, `src-tauri/`) + **SolidJS + TypeScript + Vite** (`src/`), using lichess
`chessground` (board) and `chessops` (rules/PGN). Bulma + SCSS. Puzzles and game history live
in an embedded **SQLite** database (`rusqlite`, bundled SQLite).

Target platforms: **macOS first, then Windows. Linux is not a target**, so Linux-only
build issues are not bugs (e.g. case-sensitive file names) and CI runs on macOS and Windows only.

## Commands

Package manager is **pnpm** (lockfile committed; CI uses pnpm 10, Node 22).

```bash
pnpm install              # install JS deps
pnpm tauri dev            # run the desktop app (starts Vite on :1420 + the Rust app)
pnpm dev                  # frontend only in a browser; Tauri APIs (invoke, fs) will fail
pnpm typecheck            # tsc --noEmit  (Vite does NOT typecheck, so run this)
pnpm lint                 # ESLint 9 flat config, prettier enforced as a rule
pnpm lint --fix           # autofix formatting (see the Solid ref gotcha below)
pnpm test                 # Vitest unit tests (src/**/*.test.ts, Node environment)
pnpm build                # vite build -> dist/
pnpm tauri build          # packaged app (.app/.dmg on macOS, .msi/.exe on Windows)
pnpm build:mac            # signed macOS .app; needs APPLE_SIGNING_IDENTITY (see README): ad-hoc
                          # builds lose macOS permissions (Screen Recording) on every rebuild
pnpm tauri icon ./tools/Logo.png   # regenerate app icons

# Rust: CI runs fmt --check, clippy -D warnings and tests (macOS and Windows); run them
# locally whenever src-tauri/ changes.
cd src-tauri && cargo check
cd src-tauri && cargo clippy
cd src-tauri && cargo fmt --check
```

Rust 1.97 or newer is required (`rust-version` in Cargo.toml, for pgn-reader 0.29 / shakmaty 0.30);
`rustup update stable` if a machine is older.
Building the Rust side needs a C compiler for the bundled SQLite: the Xcode command line tools on
macOS, the MSVC build tools on Windows. (No LLVM/libclang since SurrealDB was removed.)

Unit tests use **Vitest** (`vitest.config.ts`, Node environment, no Solid plugin) and cover the
pure modules (`src/models/*.test.ts`, `src/engine/*.test.ts`, `src/scan/*.test.ts`, ...; the
scanner's run the real ONNX model). Keep tested modules free of Tauri and settings imports
(`settings.ts` touches `window` on import). Rust modules have `cargo test` unit tests (temp
folders and in-memory stores, no network or keychain). UI behaviour is verified by running the app.

Before pushing: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`, plus `cargo check` if
Rust changed.
`/check` runs all of it.

## Branches and PRs

- **`develop` is the working branch.** Branch from `develop` and open PRs against `develop`.
  `main` is behind and only receives merges from `develop`.
- Releases: a `vX.Y.Z` tag matching `package.json` (the app's version; `tauri.conf.json` reads
  it) runs `.github/workflows/release.yml` into a draft GitHub release with the updater files
  (`tauri.release.conf.json` turns them on, so local builds need no signing key). The
  one-time key and secret setup is in the README.
- CI (`.github/workflows/ci.yml`) runs on every PR and on pushes to `main`, on `macos-latest`
  and `windows-latest`: typecheck, lint, test, build (frontend job), and `cargo fmt --check`,
  `cargo clippy --all-targets -- -D warnings`, `cargo test` (rust job, which builds the
  frontend first because Tauri embeds `dist`). A clippy warning fails CI, also one that only
  shows on Windows (e.g. an import used only in a macOS `#[cfg]` branch).
- Feature branches are named `feature/<topic>`. Commit messages loosely follow Conventional
  Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `style:`, `build:`).
- The prettier reformat commit is listed in `.git-blame-ignore-revs`
  (`git config blame.ignoreRevsFile .git-blame-ignore-revs`).

## Architecture

```
src/
  index.tsx, App.tsx       router: / /game /analysis /play /puzzles /puzzle /library /books /reader /history /boardeditor /settings /guess /databases
  Views/                   route pages. GameView = file load/save/puzzle wrapper around GameManager.
                           Play, Puzzles, History, LibraryFolder, Books, Sidebar, Layout.
  components/game/         useTutor.tsx + TutorPanel.tsx (the tutor in Play: plays through the explainer
                           engine, decisions in models/tutor.ts),
                           GameManager.tsx (the hub: state, PGN sync, engine/clock/tutor wiring) with
                           BoardArea.tsx (board column), boardConfig.ts (chessground config),
                           usePuzzle.ts, useMoveInput.ts, gameApi.ts; AnalysisPanel.tsx (the panel:
                           toolbar + PanelSection sections), EvalBar, GameContext.tsx (shared signals),
                           useChessEngine.tsx (engine state), Moves/Ply (move tree), Review,
                           EngineControl, EngineInfoViewer, Comments, PgnEditBar, SidebarTabs
  components/common/       chessboard wrapper, Menu, Modal, Alert, Select, MarkdownEditor, utils.tsx
  components/boardeditor/  position editor
  components/shell/        app shell: CommandPalette (⌘K), PageHeader; the sidebar is Views/Sidebar.tsx,
                           its screens and groups in models/navigation.ts (a new screen goes there)
  models/                  pgn.ts (chessops tree -> view model, Path type), GameModel.ts (immutable game ops),
                           settings.ts (JSON settings in AppConfig, Solid store), puzzles.ts (score formula)
  engine/                  uciengine.ts (UCI protocol parser) over executableuci.ts (talks to Rust engine_* commands),
                           engineprofiles.ts (profiles, startEngine, humanProfile), lc0.ts (Maia move stats),
                           explainer.ts (a background second engine for the searches behind explanations)
  reasons/                 move reasons in chess terms (docs/REASONS.md): motifs.ts (tactics in a line),
                           threats.ts (what a move stops and threatens, in words); *.eval.ts = measurements
  online/                  onlinegames.ts (chess.com/Lichess sync into Library/Online), autosync.ts (sync on
                           start and review new games in the background, listed on Today)
  storage/                 updates.ts (the updater: check, install, the check on start; X.1),
                           fs.ts (Tauri fs wrappers: Library, settings, themes), db.ts (invoke() wrappers for db.rs),
                           library.ts (Library listings with dates, search walk, dropped-file import)
  theming/                 dynamic CSS loading for board/piece themes (src/assets/styles)
src-tauri/src/
  lib.rs                   plugin setup, setup hook, command registration (generate_handler!)
  db.rs                    SQLite: puzzles (weights, pick_puzzle) and history; schema steps in SCHEMA
                           (PRAGMA user_version), one-time import of tools/surreal-export output
  games.rs                 game databases: PGN import (pgn-reader/shakmaty), search, position index
  lichess_puzzles.rs       Lichess puzzle CSV import/download, pick by theme and rating, puzzle Elo
  capture.rs               "Capture from screen" for the scanner (macOS screencapture -i, hides the window)
  repertoire.rs            repertoire files and their spaced-repetition cards
  library.rs               files dropped on the window (paths kept from the window event) copied into
                           a Library folder: the webview names only the folder, never a source path
  secrets.rs               API tokens in the OS keychain, never returned to the webview
  books.rs                 Polyglot opening books (binary search on disk) in <AppLocalData>/Books
  net.rs                   all HTTP (chess.com / Lichess game import), fixed hosts
  engine.rs                engine process management (engine_list/spawn/write/kill) + open_library_path
  export.rs                export_save: save dialog + write for exported images/GIFs (raw bytes body)
  backup.rs                backups (zip of Library, settings, the user's own tables), restore, daily auto
  migrate.rs               one-time move of user data from the old "rechess" identifier folders
src-tauri/capabilities/    webview permissions (default.json, desktop.json)
```

Data flow: the **PGN string is the source of truth** for a game. Edits go through `GameModel`
(immutable) and re-serialize the whole multi-game PGN. UI state lives in Solid signals in
`GameManager`, shared to children via `GameContext`.

User data locations (resolved by Tauri from the bundle identifier):
- `<AppLocalData>/Library` user PGN files and folders
- `<AppLocalData>/Engines` UCI engine binaries (the first one found is used)
- `<AppLocalData>/Books` Polyglot opening books (imported in Settings)
- `<AppLocalData>/Backups` automatic daily backups and the copies made before a restore
  (`backup.rs`; a new user table belongs in its `USER_TABLES`, or backups miss it)
- `<AppLocalData>/rechess.sqlite` database (the old SurrealDB `db/` folder is no longer read;
  `tools/surreal-export` turns it into `surreal-export.json`, imported on the next start)
- `<AppConfig>` settings JSON

## Conventions

- Formatting: prettier, 4 spaces, semicolons, trailing commas; LF line endings (`.gitattributes`).
  Lint fails on formatting, so let prettier/`eslint --fix` do it.
- Unused names: prefix with `_` to mark them intentional. `no-explicit-any` is a warning, not an
  error; avoid adding new ones.
- Logging: use `anylogger` (`const log = anylogger("module")`), not `console.log`.
- Imports are relative; there are no path aliases.
- Settings keys are dotted strings (e.g. `engine.playing.elo`). Read and write the exact same key
  and keep defaults in `settings.ts` DEFAULT rather than scattering fallbacks.

### SolidJS

- Do not destructure `props`; it breaks reactivity. Use `props.x` or `splitProps`.
- Element refs are assigned by Solid via `ref={el}`, so they must stay `let el`. `eslint --fix`
  wants `prefer-const` there; such lines carry an inline `// eslint-disable-next-line prefer-const`.
  Never let an autofix turn them into `const`.
- Signals are called: `value()`, not `value`.

### Tauri / Rust

- **The webview has no shell access.** Engines are spawned only by Rust (`engine.rs`) and only
  from the Engines folder, which the webview's fs scope denies. Do not add `shell:*` permissions or
  widen `fs` scopes in `capabilities/`; add a narrow Rust command instead.
- **Secrets** (API tokens) live in the OS keychain via `secrets.rs`. Commands may store, delete
  or report whether a secret is set, never return its value; Rust code that calls an API reads
  it with `Secrets::get` and attaches it (e.g. `bearer_auth`). New secrets are new `Secret`
  variants, so the webview cannot name arbitrary keychain entries.
- Adding a command: write it in the right module with `#[tauri::command]`, register it in
  `lib.rs` `generate_handler![...]`, wrap the `invoke()` in `src/storage/db.ts` (or the engine
  module), and keep TS types in sync with Rust structs (e.g. `EngineEvent` is mirrored in
  `executableuci.ts`). Commands return `Result<T, String>`; avoid `unwrap()` in command paths.
- Resolve file locations with `app.path().app_local_data_dir()` / `app_config_dir()`, never with
  relative paths (a packaged app's working directory is `/` on macOS or `Program Files` on Windows).
- The CSP in `tauri.conf.json` is the backstop against injected HTML. Anything from a PGN or user
  input rendered through `innerHTML` (Comments, MarkdownEditor) must be escaped or sanitized
  with DOMPurify. `'wasm-unsafe-eval'` is there for the scanner's ONNX runtime (`src/scan`, run
  single-threaded) and pdf.js's image decoders; `font-src data:` lets pdf.js load PDF fonts
  (chess diagrams are often drawn with chess fonts). pdf.js's worker is a bundled asset; its
  decoders and standard fonts are served from `/pdfjs`, which `tools/copy-pdfjs-assets.mjs`
  fills from node_modules on every `pnpm dev` / `pnpm build` (git-ignored). `frame-src` allows
  only `https://www.youtube-nocookie.com`, for the video player (`components/video`).
- The CSP is enforced only in built apps, not under `tauri dev`: check styling changes in a
  build. Board and piece themes are injected `<style>` elements with `data:` images, and
  solid-toast injects its styles too, hence `style-src 'unsafe-inline'` and `img-src data:`;
  custom themes are fetched over the asset protocol (`connect-src asset:`). Tauri would add hashes
  of index.html's inline `<style>` to `style-src`, and a hash makes browsers ignore
  `'unsafe-inline'`, so `dangerousDisableAssetCspModification` is set for `style-src` only.

## Gotchas

- **Bundle identifier is `com.canna71.rechess`** (decided). Changing it moves every user's
  Library, settings and DB; `migrate.rs` exists to move data from the old `rechess` identifier.
- `src-tauri/gen/schemas` is generated/ignored. The capability `$schema`
  points at `gen/schemas`, which appears after the first `cargo build`/`tauri dev`.
- On macOS, a downloaded engine binary may be quarantined or not executable (`chmod +x`,
  `xattr -d com.apple.quarantine`). Engine start failures mostly surface in the log only.
- chessground caches the board's screen position and refreshes it only on resize or scroll.
  `components/common/chessboard.tsx` clears it at every press, because a board moved by the
  layout around it (a panel above it changing) would otherwise put moves on the wrong squares.
- Paths in routes must be URL-encoded (`encodeURIComponent`) because file names can contain `&#?+`.
- Known refactor targets: make `useChessEngine` an explicit state machine,
  a typed settings schema, split `components/common/utils.tsx`, add Vitest + Rust CI.

## Roadmap

`docs/ROADMAP.md` tracks planned features by ID (`P1.1`, ...) with status and acceptance criteria.
Read it before starting feature work, and update an item's status in the same branch that changes it.
`docs/SCANNING.md` explains position recognition, book scanning and the PDF reader (`src/scan`,
`BookScanView`, `PdfReader`): the pipeline, why each step exists, how to test it, and known limits.
Read it before touching recognition, and keep it current.
`docs/REASONS.md` is the plan for explaining moves in chess terms (P2.8): the kinds of reasons,
how each is computed, and `pnpm eval:reasons`, which measures detectors against the Lichess
puzzle themes. Read it before touching `models/explain.ts` or `src/reasons`.
`docs/TESTING.md` lists what the owner still has to try by hand (things automated checks can't
confirm). Add steps there for every feature or fix that needs the running app, in its branch.

## Looking at the running app

For UI work, Claude can see the app: with `pnpm tauri dev` running, `tools/shot.sh <name>
['{"go":"/analysis","click":"css","key":"ArrowRight","theme":"light","move":"e2e4 g1f3"}']`
sends a command to the
dev-only driver (`src/dev/devdriver.ts`, which polls `public/dev-driver.json`; never in
production builds) and captures the app window to `$SHOTS/<name>.png`. It needs the Screen
Recording permission for the terminal/editor running it; `tools/winid` is built from
`tools/winid.swift` on first use. `move` plays UCI moves on the largest board by clicking
their squares (dev builds set chessground's `trustAllEvents` for this), so puzzles, trainers
and play go through their normal move handling. `scroll` brings an element into view and
`hover` sends it mouseenter/mouseover (`click` also focuses fields, for `type`). Changing
`devdriver.ts` reloads the page, so change it before setting up a position. Dev builds have no CSP, so check CSP-sensitive things in a
built app as well. The webview's console errors and warnings appear in the `pnpm tauri dev`
terminal as `[webview] …` (`tools/vite-devlog.ts`, dev server only).

Styling: colours, spacing and type come from the tokens in `src/styles/tokens.scss` (`--rc-*`,
plus Bulma's own variables themed there) and the base component styles in `src/styles/_base.scss`.
Use the tokens; don't hard-code colours. Light/dark follows the system or `themes.ui`
(Settings → Appearance), applied as `data-theme` on `<html>`. The UX overhaul plan and its
decisions are in `docs/UX.md`.

## Claude Code setup in this repo

- `.claude/agents/`: `reviewer` (reviews a diff against these rules), `tauri-rust` (Rust backend,
  commands, capabilities, packaging), `solid-frontend` (SolidJS/TS UI and chess logic).
- `.claude/commands/`: `/check` (all local checks), `/new-feature <topic>` (branch from develop),
  `/pr` (verify and open a PR against develop), `/add-command <name>` (new Tauri command end to end).
- `.claude/settings.json`: allows the routine build/check commands without prompting.
  Put personal overrides in `.claude/settings.local.json` (git-ignored).
