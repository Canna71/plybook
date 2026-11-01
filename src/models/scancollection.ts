// Diagrams scanned from a book, saved as one PGN per diagram so each can be studied or, with a
// solution, trained as a puzzle.

import { Chess, Color, Move, parseUci } from "chessops";
import { parseFen } from "chessops/fen";
import { ChildNode, makePgn, Node, parsePgn, PgnNodeData } from "chessops/pgn";
import { makeSanAndPlay, parseSan } from "chessops/san";

export type ScannedDiagram = {
    page: number;
    /** Order on the page, from 1 */
    index: number;
    fen: string;
    /** The engine's best move(s), in UCI, when solved */
    solution?: string[];
    /** The side at the bottom of the printed diagram, kept so the board doesn't turn to face
     * the side to move (F.23) */
    orientation?: Color;
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

/**
 * Text selected in a book, as a comment: on one line (PDF text breaks at every line end, with
 * hyphenated words split), with the page it came from.
 */
export function bookQuote(text: string, page: number): string {
    const quote = text
        // a word broken at the line end, else a hyphen that belongs ("f7-square")
        .replace(/([a-z])-[ \t]*\n\s*([a-z])/g, "$1$2")
        .replace(/-[ \t]*\n\s*/g, "-")
        .replace(/\s+/g, " ")
        .trim();
    return quote ? `${quote} (p. ${page})` : "";
}

/** The move of a diagram's notes the diagram shows, when they start with the game before it. */
export function diagramPly(pgn: string): number | undefined {
    const ply = /^\[DiagramPly "(\d+)"\]/m.exec(pgn);
    return ply ? +ply[1] : undefined;
}

/**
 * A diagram's notes: whose move it is in the diagram (at their start, or after the game before
 * it), and whether they have moves yet.
 */
export function notesStart(pgn: string): { turn?: Color; moves: boolean } {
    const game = parsePgn(pgn)[0];
    if (!game) return { moves: false };
    const fen = game.headers.get("FEN");
    const setup = fen ? parseFen(fen) : undefined;
    const ply = diagramPly(pgn);
    return {
        turn:
            ply !== undefined
                ? ply % 2
                    ? "black"
                    : "white"
                : setup?.isOk
                  ? setup.value.turn
                  : undefined,
        moves: game.moves.children.length > 0,
    };
}

/**
 * A diagram's notes starting with the game before it (F.11): `moves` from the initial position
 * to the diagram, marked with a comment and the `DiagramPly` header, then the notes' own moves
 * and comments. Undefined if the notes' moves don't play from there.
 */
export function withGameBefore(
    pgn: string,
    moves: Move[],
    page: number,
): string | undefined {
    const game = parsePgn(pgn)[0];
    if (!game || !moves.length) return undefined;
    const pos = Chess.default();
    const line: ChildNode<PgnNodeData>[] = [];
    for (const move of moves) {
        if (!pos.isLegal(move)) return undefined;
        line.push(new ChildNode({ san: makeSanAndPlay(pos, move) }));
    }
    // the notes' main line must still play after the game before
    const check = pos.clone();
    for (const data of game.moves.mainline()) {
        const move = parseSan(check, data.san);
        if (!move) return undefined;
        check.play(move);
    }
    line.forEach((node, i) => {
        if (i > 0) line[i - 1].children = [node];
    });
    const last = line[line.length - 1];
    last.data.comments = [`Diagram, p. ${page}`, ...(game.comments ?? [])];
    last.children = game.moves.children;
    const root = new Node<PgnNodeData>();
    root.children = [line[0]];
    game.headers.delete("SetUp");
    game.headers.delete("FEN");
    game.headers.set("DiagramPly", String(moves.length));
    return makePgn({ headers: game.headers, comments: [], moves: root });
}

/**
 * A diagram's notes with another start (the side to move changed in the reader, F.22), and the
 * printed orientation, comments kept; undefined once they have moves, which would not fit.
 */
export function restartedNotes(
    pgn: string,
    fen: string,
    orientation?: Color,
): string | undefined {
    const game = parsePgn(pgn)[0];
    if (!game || game.moves.children.length) return undefined;
    game.headers.set("SetUp", "1");
    game.headers.set("FEN", fen);
    if (orientation) game.headers.set("Orientation", orientation);
    return makePgn(game);
}

/** Notes saved before they recorded the printed orientation get it, so the board keeps it (F.23). */
export function withOrientation(pgn: string, orientation: Color): string {
    if (/^\[Orientation /m.test(pgn)) return pgn;
    const game = parsePgn(pgn)[0];
    if (!game) return pgn;
    game.headers.set("Orientation", orientation);
    return makePgn(game);
}

/** A PGN as chessops writes it, so the same games compare equal however they were spaced. */
export const normalPgn = (pgn: string) =>
    parsePgn(pgn)
        .map((g) => makePgn(g))
        .join("\n");

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
        ...(d.orientation ? [header("Orientation", d.orientation)] : []),
        header("Annotator", "Plybook scan"),
        "",
        [...tokens, "*"].join(" "),
        "",
    ].join("\n");
}
