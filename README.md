# Rechess

A tool for practicing and studying chess.

## License

GPL-3.0-or-later (see `LICENSE`). ReChess builds on [chessground](https://github.com/lichess-org/chessground)
and [chessops](https://github.com/niklasf/chessops) in the app, and [shakmaty](https://github.com/niklasf/shakmaty)
and [pgn-reader](https://github.com/niklasf/rust-pgn-reader) in its Rust side, all GPL-3.0 (or
later), so the app as distributed is under the same license. Chess engines such as Stockfish are not bundled: you
install them yourself, and they keep their own licenses.

Piece sets each keep their own licence (GPL, AGPL, MIT, Apache, CC BY, CC BY-SA, CC0 and others):
authors, licences and sources are in `src/assets/styles/pieces/README.md`.

Data bundled with the app: opening names (ECO codes and names) from
[lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), CC0 1.0, in
`src/assets/openings` (see its README for the version). No opening book is bundled: Settings →
Opening books imports one or makes one from a PGN of games you choose, such as a month of the
[Lichess database](https://database.lichess.org) (CC0).



## Features in the roadmap:

- Play against the computer
- Play against a friend
- Study chess openings
- Study endgames
- Study tactics
- Study strategy
- Analyze games
- Create and share chess puzzles
- Create and share chess games
- Access online chess databases (e.g. Lichess)
- Access online chess engines (e.g. Stockfish)
- Store books, games, puzzles, etc. locally
- Sync books, games, puzzles, etc. with cloud storage
- Capture board positions from images
- Connect to physical chess boards (e.g. DGT boards) (if possible)


## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## To run the project

```bash
pnpm install
pnpm tauri dev
```

### macOS builds: sign with a stable identity

Unsigned (ad-hoc) builds get a new identity on every build, so macOS forgets permissions such as
Screen Recording (used by "Capture from screen") and asks again after each rebuild. Sign with your
certificate instead; list yours with `security find-identity -v -p codesigning`:

```bash
export APPLE_SIGNING_IDENTITY="Apple Development: Your Name (TEAMID)"   # e.g. in ~/.zshrc
pnpm build:mac        # tauri build --bundles app, refuses to run unsigned
```

After the first signed build, remove old `rechess` entries in System Settings → Privacy &
Security → Screen Recording, grant the permission again and reopen ReChess once.

### Releases and updates

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

To release, set the new `version` in `package.json` (the app reads its version from there), commit,
and push a matching tag:

```bash
git tag v0.2.0 && git push origin v0.2.0
```

`.github/workflows/release.yml` builds macOS (Apple silicon and Intel) and Windows into a
**draft** release. Write the notes (they are shown in the app), then publish it: from then on the
apps offer it. Windows installers are not code-signed, so SmartScreen warns on a first install.

### To build icons:

```bash
pnpm tauri icon ./tools/Logo.png
```

## Dependencies

A C compiler for the bundled SQLite: Xcode command line tools on macOS, MSVC build tools on Windows.

### Data from older versions (SurrealDB)

Versions before the SQLite move kept puzzles and played games in `<AppLocalData>/db`. To bring
them over, close ReChess and run once (this needs LLVM/libclang to build):

```bash
cd tools/surreal-export
cargo run --release -- "$HOME/Library/Application Support/com.canna71.rechess"
```

The next start imports `surreal-export.json`; the old `db` folder is left alone and can be deleted.

## Links

https://github.com/lichess-org/chessground

https://github.com/lichess-org/pgn-viewer

https://lichess.org/editor

https://github.com/nmrugg/stockfish.js

https://niklasf.github.io/chessops/

https://github.com/victorocna/chessground-stockfish/tree/master

https://stockfishchess.org/

https://lczero.org/

https://github.com/lichess-org/stockfish.js

https://github.com/hi-ogawa/Stockfish

https://stackoverflow.com/questions/77194959/how-to-integrate-stockfish-in-html-with-chess-js-and-chessboard-js

https://lichess.org/source

https://github.com/lichess-org/lila/tree/master/ui

https://www.chessboardjsx.com/integrations/stockfish

https://codesandbox.io/p/sandbox/chess-with-react-chessground-forked-qwjntr?file=%2Fsrc%2Fengine%2Fenginegame.js%3A4%2C27

https://gist.github.com/DOBRO/2592c6dad754ba67e6dcaec8c90165bf

https://github.com/niklasf/chessops/blob/edd0823f31551452f63aa8cb41d91675d548b8f7/src/pgn.ts#L202

# Sidecar

https://medium.com/@samuelint/tauri-how-to-start-stop-a-sidecar-and-pipe-sidecar-stdout-stderr-to-app-logs-from-rust-8f81a92111ad

https://github.com/tauri-apps/tauri/discussions/3273
