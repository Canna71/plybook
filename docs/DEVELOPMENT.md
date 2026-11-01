# Developing Plybook

Plybook is a [Tauri 2](https://tauri.app) app: a Rust side (`src-tauri/`) and a SolidJS +
TypeScript front end (`src/`), with [chessground](https://github.com/lichess-org/chessground)
for the board and [chessops](https://github.com/niklasf/chessops) for the rules. The layout of
the code, the conventions and the gotchas are in [`CLAUDE.md`](../CLAUDE.md); the plan is in
[`ROADMAP.md`](ROADMAP.md).

## Run it

You need Node 22, [pnpm](https://pnpm.io) 10, Rust 1.97 or newer (`rustup update stable`), and a
C compiler for the bundled SQLite: the Xcode command line tools on macOS, the MSVC build tools
on Windows.

```bash
pnpm install
pnpm tauri dev
```

Recommended editor: [VS Code](https://code.visualstudio.com/) with the
[Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) and
[rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
extensions.

## Checks

The same as CI (macOS and Windows), before pushing:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm build
cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```

`docs/TESTING.md` lists what still needs a person and the running app.

## macOS builds: sign with a stable identity

Unsigned (ad-hoc) builds get a new identity on every build, so macOS forgets permissions such as
Screen Recording (used by "Capture from screen") and asks again after each rebuild; the Keychain
too asks again for the API tokens (Lichess, the explanation model), as "Always Allow" was given
to the previous build only. `pnpm tauri build` makes such builds. Sign with your
certificate instead; list yours with `security find-identity -v -p codesigning`:

```bash
export APPLE_SIGNING_IDENTITY="Apple Development: Your Name (TEAMID)"   # e.g. in ~/.zshrc
pnpm build:mac        # tauri build --bundles app, refuses to run unsigned
```

After the first signed build, remove old `rechess` entries in System Settings → Privacy &
Security → Screen Recording, grant the permission again and reopen Plybook once, and answer
the Keychain's question with "Always Allow": builds signed with the same certificate keep both.

## Releases and updates

The app checks `latest.json` on the newest GitHub release a little after start (Settings →
Updates) and installs an update only if its signature matches the `pubkey` in
`src-tauri/tauri.conf.json`. The repository must be public, so the app can download releases
without logging in.

One-time setup:

1. Generate the updater key, and keep the private half and its password safe (losing it means
   installed apps can no longer update):
   ```bash
   pnpm tauri signer generate -w ~/.tauri/rechess.key
   ```
   Put the public key (the contents of `~/.tauri/rechess.key.pub`) in `tauri.conf.json`
   `plugins.updater.pubkey`.
2. Add the repository secrets (Settings → Secrets and variables → Actions):
   - `TAURI_SIGNING_PRIVATE_KEY` (the contents of `~/.tauri/rechess.key`) and
     `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`;
   - for macOS, a **Developer ID Application** certificate (an "Apple Development" one is not
     enough to give the app to others): `APPLE_CERTIFICATE` (the exported .p12, base64:
     `base64 -i cert.p12 | pbcopy`), `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`
     (`Developer ID Application: Your Name (TEAMID)`), and for notarization `APPLE_ID`,
     `APPLE_PASSWORD` (an app-specific password from account.apple.com) and `APPLE_TEAM_ID`.

To release, set the new version with `pnpm bump patch` (or `minor`, `major`, `X.Y.Z`). It writes
`package.json` (the app reads its version from there), `src-tauri/Cargo.toml` and `Cargo.lock`,
and prints the commands to commit and push a matching tag:

```bash
git commit -am "chore: version 0.2.0"
git tag v0.2.0 && git push origin develop v0.2.0
```

The app shows its version in Help and in Settings → Updates.

`.github/workflows/release.yml` builds macOS (Apple silicon and Intel) and Windows into a
**draft** release. Write the notes (they are shown in the app), then publish it: from then on the
apps offer it. Windows installers are not code-signed, so SmartScreen warns on a first install.

## Icons

```bash
pnpm tauri icon ./tools/Logo.png
```

## Data from older versions (SurrealDB)

Versions before the SQLite move kept puzzles and played games in `<AppLocalData>/db`. To bring
them over, close Plybook and run once (this needs LLVM/libclang to build):

```bash
cd tools/surreal-export
cargo run --release -- "$HOME/Library/Application Support/com.canna71.plybook"
```

The next start imports `surreal-export.json`; the old `db` folder is left alone and can be deleted.

## Design notes

- [`EXPLANATIONS.md`](EXPLANATIONS.md): how a move is explained in words, and what keeps it honest.
- [`REASONS.md`](REASONS.md): each kind of reason, how it is computed and how it was measured.
- [`SCANNING.md`](SCANNING.md): position recognition, book scanning and the PDF reader.
- [`UX.md`](UX.md): the interface's plan and decisions.

## References

- chessground: https://github.com/lichess-org/chessground
- chessops: https://niklasf.github.io/chessops/
- Lichess source: https://lichess.org/source, https://github.com/lichess-org/lila/tree/master/ui
- Lichess PGN viewer: https://github.com/lichess-org/pgn-viewer
- Lichess board editor: https://lichess.org/editor
- Stockfish: https://stockfishchess.org/; Lc0: https://lczero.org/
- Stockfish in the browser: https://github.com/nmrugg/stockfish.js,
  https://github.com/lichess-org/stockfish.js, https://github.com/hi-ogawa/Stockfish
- chessground with Stockfish: https://github.com/victorocna/chessground-stockfish
- Tauri sidecars: https://github.com/tauri-apps/tauri/discussions/3273
