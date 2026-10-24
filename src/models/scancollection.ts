// Diagrams scanned from a book, saved as one PGN per diagram so each can be studied or, with a
// solution, trained as a puzzle.

import { Chess, parseUci } from "chessops";
import { parseFen } from "chessops/fen";
import { makeSanAndPlay } from "chessops/san";

export type ScannedDiagram = {
    page: number;
    /** Order on the page, from 1 */
    index: number;
    fen: string;
    /** The engine's best move(s), in UCI, when solved */
    solution?: string[];
};

const header = (name: string, value: string) =>
    `[${name} "${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;

/** A folder name for the book: file-safe, without the extension. */
export const collectionName = (fileName: string) =>
    fileName
        .replace(/\.[a-z0-9]+$/i, "")
        .replace(/[\\/:*?"<>|]/g, "-")
        .trim() || "Scanned book";

/** "p012-2.pgn": sorts in book order. */
export const diagramFileName = (d: ScannedDiagram) =>
    `p${String(d.page).padStart(3, "0")}-${d.index}.pgn`;

/** The diagram as a PGN game; the solution, if any, as its moves. */
export function diagramPgn(book: string, d: ScannedDiagram): string {
    const tokens: string[] = [];
    if (d.solution?.length) {
        const setup = parseFen(d.fen);
        const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
        if (pos?.isOk) {
            const position = pos.value;
            let fullmove = position.fullmoves;
            tokens.push("{ Best move found by the engine }");
            for (const [i, uci] of d.solution.entries()) {
                const move = parseUci(uci);
                if (!move || !position.isLegal(move)) break;
                const white = position.turn === "white";
                if (white) tokens.push(`${fullmove}.`);
                else if (i === 0) tokens.push(`${fullmove}...`);
                tokens.push(makeSanAndPlay(position, move));
                if (!white) fullmove++;
            }
        }
    }
    return [
        header("Event", `${book}, page ${d.page}`),
        header("Site", "?"),
        header("Result", "*"),
        header("SetUp", "1"),
        header("FEN", d.fen),
        header("Annotator", "ReChess scan"),
        "",
        [...tokens, "*"].join(" "),
        "",
    ].join("\n");
}
