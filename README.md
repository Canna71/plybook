# Rechess

A tool for practicing and studying chess.

## To Do List

- [ ] Use an engine configurable by user

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

## Dependencies

LLVM 
https://releases.llvm.org/
https://users.rust-lang.org/t/unable-to-find-libclang-the-libclang-issue/70746

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

# Context Menu
```js
import { listen } from "@tauri-apps/api/event";
import { Menu } from "@tauri-apps/api/menu";
import React, { useEffect } from "react";

const RightClickMenu: React.FC = () => {
  const menuPromise = Menu.new({
    items: [
      { id: "ctx_option1", text: "Option 1" },
      { id: "ctx_option2", text: "Option 2" },
    ],
  });

  async function clickHandler(event: React.MouseEvent) {
    event.preventDefault();
    const menu = await menuPromise;
    menu.popup();
  }

  useEffect(() => {
    const unlistenPromise = listen<string>("menu-event", (event) => {
      if (!event.payload.startsWith("ctx")) return;
      switch (event.payload) {
        default:
          console.log("Unimplemented application menu id:", event.payload);
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);

  return (
    <div
      onContextMenu={clickHandler}
      style={{ padding: "20px", border: "1px solid #ccc" }}
    >
      Right-click anywhere in this area to see the context menu.
    </div>
  );
};
export default RightClickMenu;
```
