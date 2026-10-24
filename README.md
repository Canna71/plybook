# Rechess

A tool for practicing and studying chess.



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
