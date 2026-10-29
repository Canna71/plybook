// Dev builds only (`pnpm tauri dev`): lets a script drive the running app, so UI work can be
// checked with screenshots without clicking by hand. The app polls /dev-driver.json (served by
// Vite from public/, git-ignored) and runs each new command once. Production builds never
// call this: `import.meta.env.DEV` is false there and the module is dropped.
//
// A command: { "id": "any unique value", "go": "/route", "click": "css selector",
//              "type": "text", "key": "ArrowRight", "theme": "light" | "dark" | "",
//              "move": "e2e4 g1f3", "draw": "e2e4 d4d4", "scroll": "css selector",
//              "hover": "css selector" }

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
    /** Drags on the main board, "e2e4" or "e4e4" for one square, separated by spaces */
    draw?: string;
    /** Scrolls this element into view (after the other commands) */
    scroll?: string;
    /** Moves the mouse onto this element (mouseenter and mouseover) */
    hover?: string;
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

/** A point at the centre of a square of the board, for mouse events */
function squareAt(board: HTMLElement, square: string) {
    const r = board.getBoundingClientRect();
    const white = !board.closest(".orientation-black");
    const file = square.charCodeAt(0) - 97;
    const rank = square.charCodeAt(1) - 49;
    const col = white ? file : 7 - file;
    const row = white ? 7 - rank : rank;
    return {
        clientX: r.left + ((col + 0.5) * r.width) / 8,
        clientY: r.top + ((row + 0.5) * r.height) / 8,
        button: 0,
        bubbles: true,
    };
}

/** Clicks a square as a user would: press on the board, release on the document. */
function clickSquare(board: HTMLElement, square: string) {
    const at = squareAt(board, square);
    board.dispatchEvent(new MouseEvent("mousedown", at));
    document.dispatchEvent(new MouseEvent("mouseup", at));
}

const frame = () => new Promise((done) => setTimeout(done, 50));

/**
 * Drags from one square to another with frames in between, as a hand does: chessground
 * notes the square under the pointer on the next frame, so a press released at once draws
 * nothing. The same square twice is a click that lasts (a circle in pen mode).
 */
async function dragSquares(board: HTMLElement, from: string, to: string) {
    board.dispatchEvent(new MouseEvent("mousedown", squareAt(board, from)));
    await frame();
    document.dispatchEvent(new MouseEvent("mousemove", squareAt(board, to)));
    await frame();
    document.dispatchEvent(new MouseEvent("mouseup", squareAt(board, to)));
}

/** Drags each "e2e4" in turn (arrows in pen mode; "e4e4" a circle) */
async function drawShapes(shapes: string) {
    for (const s of shapes
        .split(/\s+/)
        .filter((m) => /^[a-h][1-8][a-h][1-8]$/.test(m))) {
        const board = mainBoard();
        if (!board) return log.warn("no board for", s);
        await dragSquares(board, s.slice(0, 2), s.slice(2, 4));
        await frame();
    }
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
                if (el) {
                    // fields take "type" after a click, as when clicked by hand
                    el.focus();
                    el.click();
                } else log.warn("nothing matches", cmd.click);
            }
            // text into the focused field, as if typed
            if (cmd.type !== undefined) {
                const el = document.activeElement as HTMLInputElement | null;
                if (el && "value" in el) {
                    el.value = cmd.type;
                    el.dispatchEvent(new Event("input", { bubbles: true }));
                    // selects (and some fields) listen for change instead
                    el.dispatchEvent(new Event("change", { bubbles: true }));
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
            if (cmd.draw) void drawShapes(cmd.draw);
            if (cmd.scroll) {
                const el = document.querySelector(cmd.scroll);
                if (el) el.scrollIntoView({ block: "center" });
                else log.warn("nothing matches", cmd.scroll);
            }
            if (cmd.hover) {
                const el = document.querySelector(cmd.hover);
                if (el) {
                    el.dispatchEvent(new MouseEvent("mouseenter"));
                    el.dispatchEvent(
                        new MouseEvent("mouseover", { bubbles: true }),
                    );
                } else log.warn("nothing matches", cmd.hover);
            }
        }, 300);
    }, POLL);
    return () => clearInterval(timer);
}
