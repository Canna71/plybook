// Dev builds only (`pnpm tauri dev`): lets a script drive the running app, so UI work can be
// checked with screenshots without clicking by hand. The app polls /dev-driver.json (served by
// Vite from public/, git-ignored) and runs each new command once. Production builds never
// call this: `import.meta.env.DEV` is false there and the module is dropped.
//
// A command: { "id": "any unique value", "go": "/route", "click": "css selector",
//              "type": "text", "key": "ArrowRight", "theme": "light" | "dark" | "",
//              "move": "e2e4 g1f3" }

import anylogger from "anylogger";
const log = anylogger("devdriver");

type Command = {
    id: string;
    go?: string;
    click?: string;
    key?: string;
    /** Text for the focused field (after the click) */
    type?: string;
    theme?: "light" | "dark" | "";
    /** Moves on the main board, as UCI, separated by spaces */
    move?: string;
};

const POLL = 500;
const MOVE_GAP = 700;

/** The largest board on screen: the main one, not a preview */
function mainBoard(): HTMLElement | undefined {
    let best: HTMLElement | undefined;
    let size = 0;
    for (const el of document.querySelectorAll<HTMLElement>("cg-board")) {
        const r = el.getBoundingClientRect();
        if (r.width * r.height > size) {
            size = r.width * r.height;
            best = el;
        }
    }
    return best;
}

/** Clicks a square as a user would: press on the board, release on the document. */
function clickSquare(board: HTMLElement, square: string) {
    const r = board.getBoundingClientRect();
    const white = !board.closest(".orientation-black");
    const file = square.charCodeAt(0) - 97;
    const rank = square.charCodeAt(1) - 49;
    const col = white ? file : 7 - file;
    const row = white ? 7 - rank : rank;
    const at = {
        clientX: r.left + ((col + 0.5) * r.width) / 8,
        clientY: r.top + ((row + 0.5) * r.height) / 8,
        button: 0,
        bubbles: true,
    };
    board.dispatchEvent(new MouseEvent("mousedown", at));
    document.dispatchEvent(new MouseEvent("mouseup", at));
}

/** Plays each move by clicking its two squares (click-to-move), one after another. */
function playMoves(moves: string) {
    moves
        .split(/\s+/)
        .filter((m) => /^[a-h][1-8][a-h][1-8]/.test(m))
        .forEach((uci, i) =>
            setTimeout(() => {
                const board = mainBoard();
                if (!board) return log.warn("no board for", uci);
                clickSquare(board, uci.slice(0, 2));
                clickSquare(board, uci.slice(2, 4));
            }, i * MOVE_GAP),
        );
}

export function startDevDriver(navigate: (to: string) => void) {
    let last: string | undefined;
    // the command waiting when the app (re)loads already ran: don't replay it
    let started = false;
    const timer = setInterval(async () => {
        let cmd: Command;
        try {
            const res = await fetch("/dev-driver.json", { cache: "no-store" });
            if (!res.ok) {
                started = true; // nothing waiting: the next command is new
                return;
            }
            cmd = await res.json();
        } catch {
            return;
        }
        if (!cmd?.id || cmd.id === last) return;
        last = cmd.id;
        if (!started) {
            started = true;
            return;
        }
        log.info("command", cmd);
        if (cmd.theme !== undefined) {
            if (cmd.theme) document.documentElement.dataset.theme = cmd.theme;
            else delete document.documentElement.dataset.theme;
        }
        if (cmd.go) navigate(cmd.go);
        // after the route has rendered
        setTimeout(() => {
            if (cmd.click) {
                const el = document.querySelector<HTMLElement>(cmd.click);
                if (el) el.click();
                else log.warn("nothing matches", cmd.click);
            }
            // text into the focused field, as if typed
            if (cmd.type !== undefined) {
                const el = document.activeElement as HTMLInputElement | null;
                if (el && "value" in el) {
                    el.value = cmd.type;
                    el.dispatchEvent(new Event("input", { bubbles: true }));
                }
            }
            if (cmd.key) {
                document.dispatchEvent(
                    new KeyboardEvent("keydown", {
                        key: cmd.key,
                        bubbles: true,
                    }),
                );
            }
            if (cmd.move) playMoves(cmd.move);
        }, 300);
    }, POLL);
    return () => clearInterval(timer);
}
