// The game before a book's diagram (F.11): the moves the text gives up to the position shown,
// found by playing them from the start until the board is the diagram's.
//
// A book's text layer is often an OCR of the page, where pieces drawn with a chess font come
// out as junk ("tlJf3", "i.c4", "'iVe7") and digits as letters ("cS", "fl"). So a move is read
// only by what OCR keeps: its square, whether it captures, and whether it is a pawn or some
// piece. That alone would be ambiguous, but the diagram settles it: a line counts only if it
// ends on the diagram's position.

import {
    Board,
    Chess,
    COLORS,
    Move,
    Position,
    Role,
    ROLES as ROLE_LIST,
    Square,
} from "chessops";
import { makeBoardFen, parseBoardFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import { parseSquare } from "chessops/util";
import { normalizeChessText, TextItem } from "./booktext";

type Box = { x0: number; y0: number; x1: number; y1: number };

/** How many pages before the diagram's the text may start (a section's first moves). */
export const PAGES_BEFORE = 3;
/** The longest game before a diagram looked for, in plies. */
const MAX_PLY = 80;
/**
 * Positions kept at each ply, the closest to the diagram: the search stays quick on any text
 * (a 26-ply line through two pages of notes: about 0.3 s).
 */
const BEAM = 1500;

const ROLES: Record<string, Role> = {
    K: "king",
    Q: "queen",
    R: "rook",
    B: "bishop",
    N: "knight",
};

// #region the text in reading order

/** Runs whose baselines are this close are on one line (lines are about 0.019 apart). */
const LINE_TOLERANCE = 0.01;

/** Whether a page is set in two columns: lines start near the middle, at many heights. */
function twoColumns(items: TextItem[]): boolean {
    const starts = new Set(
        items
            .filter((t) => t.x0 > 0.48 && t.x0 < 0.56)
            .map((t) => Math.round(t.y0 * 100)),
    );
    return starts.size >= 5;
}

/**
 * A page's text as read: column by column, line by line, each line left to right. Runs that
 * touch are joined without a space (an OCR layer splits "t'lJ" + "f3").
 */
export function readingOrder(items: TextItem[], before?: Box): string {
    const split = twoColumns(items);
    const column = (x: number) => (split && x >= 0.48 ? 1 : 0);
    const boxColumn = before ? column((before.x0 + before.x1) / 2) : 2;
    const kept = items.filter((t) => {
        if (!before) return true;
        const c = column(t.x0);
        return c < boxColumn || (c === boxColumn && t.y1 <= before.y0 + 0.005);
    });
    // lines by their baseline (the bottom): runs in another font, as an OCR'd "..." beside a
    // move, have boxes of another height
    kept.sort((a, b) => column(a.x0) - column(b.x0) || a.y1 - b.y1);
    const lines: TextItem[][] = [];
    for (const t of kept) {
        const line = lines[lines.length - 1];
        if (
            line &&
            column(line[0].x0) === column(t.x0) &&
            t.y1 - line[0].y1 < LINE_TOLERANCE
        )
            line.push(t);
        else lines.push([t]);
    }
    return lines
        .map((line) => {
            line.sort((a, b) => a.x0 - b.x0);
            let text = "";
            line.forEach((t, i) => {
                // runs that touch are one word
                if (i > 0 && t.x0 - line[i - 1].x1 >= 0.004) text += " ";
                text += t.str;
            });
            return text;
        })
        .join(" ");
}

/**
 * The text before a diagram: the pages before its own (oldest first) and, on its page, what
 * precedes it.
 */
export function textBeforeDiagram(
    pagesBefore: TextItem[][],
    page: TextItem[],
    box: Box,
): string {
    return [
        ...pagesBefore.map((p) => readingOrder(p)),
        readingOrder(page, box),
    ].join(" ");
}

// #endregion

// #region moves as OCR keeps them

/** A move in the text, by what survives OCR. */
export type TextMove = {
    /** The ply it is numbered as: 1 for White's first move, 2 for Black's */
    ply: number;
    to?: Square;
    capture: boolean;
    /** A pawn move; for a capture, the file it comes from */
    pawn?: { file?: number };
    /** The piece when its letter is readable; else any piece but a pawn */
    role?: Role;
    castle?: "O-O" | "O-O-O";
};

/** Ellipses however printed (". . .", "• . .", "...."), and castling with zeros. */
function cleanText(text: string): string {
    return (
        normalizeChessText(text)
            .replace(/0-0-0/g, "O-O-O")
            .replace(/0-0/g, "O-O")
            .replace(/(?:[.•·]\s?){3,}|•\s?•/g, " ... ")
            // a move number glued to its move: "13l2Jxg5"
            .replace(/\b(\d{1,3})(?=[^\d\s.,;:)!?])/g, "$1 ")
    );
}

/** A word that is a move: its square, capture and piece as far as they can be read. */
function readMove(raw: string): Omit<TextMove, "ply"> | undefined {
    const word = raw
        .replace(/^[([{]+/, "")
        .replace(/(\(D\)|[+#!?,.;:)\]]|=[QRBN])+$/, "")
        // OCR digits in the square: "cS" is c5, "fl" is f1
        .replace(/([a-h])S$/, "$15")
        .replace(/([a-h])[lI]$/, "$11");
    if (/^O-O-O$/.test(word)) return { castle: "O-O-O", capture: false };
    if (/^O-O$/.test(word)) return { castle: "O-O", capture: false };
    let m = /^([a-h][1-8])$/.exec(word);
    if (m) return { to: parseSquare(m[1]), capture: false, pawn: {} };
    m = /^([a-h])x([a-h][1-8])$/.exec(word);
    if (m)
        return {
            to: parseSquare(m[2]),
            capture: true,
            pawn: { file: m[1].charCodeAt(0) - 97 },
        };
    m = /^([KQRBN])[a-h]?[1-8]?(x?)([a-h][1-8])$/.exec(word);
    if (m) return { to: parseSquare(m[3]), capture: !!m[2], role: ROLES[m[1]] };
    // a piece drawn with a chess font: anything before the square
    m = /^(.{1,6}?)(x?)([a-h][1-8])$/.exec(word);
    // junk may hold a digit ("t2Jxc6"), not only digits ("10e4")
    if (m && !/^\d+$/.test(m[1]))
        return { to: parseSquare(m[3]), capture: !!m[2] };
    return undefined;
}

/**
 * The numbered moves in a text: "5 d4 exd4" is White's and Black's fifth, "6...Bb4" Black's
 * sixth. Moves without a number before them (prose, "after ...d5") are left out.
 */
export function textMoves(text: string): TextMove[] {
    const words = cleanText(text)
        // two moves OCR'd as one word: "�e1l2Je7"
        .replace(/([a-h][1-8])(?=[^\s\d+#!?,.;:)(=]\S*[a-h][1-8])/g, "$1 ")
        .split(/\s+/)
        .filter(Boolean);
    const out: TextMove[] = [];
    let next: { n: number; black: boolean } | undefined;
    for (let i = 0; i < words.length; i++) {
        let w = words[i].replace(/^[([{]+/, "");
        // OCR: "S d4" is 5, "1 0 d5" is 10
        const after = words[i + 1] ?? "";
        if (/^[SlI]$/.test(w) && (after === "..." || readMove(after)))
            w = w === "S" ? "5" : "1";
        if (/^\d$/.test(w) && /^\d$/.test(words[i + 1] ?? "")) {
            w += words[++i];
        }
        const number = /^(\d{1,3})\.?$/.exec(w);
        if (number) {
            const black = words[i + 1] === "...";
            if (black) i++;
            next = { n: +number[1], black };
            continue;
        }
        if (w === "...") {
            next = undefined;
            continue;
        }
        let move = readMove(w);
        // a square split by OCR: "l:te 1"
        if (!move && /[a-h]$/.test(w) && /^[1-8]$/.test(words[i + 1] ?? "")) {
            move = readMove(w + words[i + 1]);
            if (move) i++;
        }
        if (move) {
            if (next) {
                out.push({ ...move, ply: next.n * 2 - (next.black ? 0 : 1) });
                next = next.black ? undefined : { n: next.n, black: true };
            }
            continue;
        }
        // signs and the diagram mark between moves; words end a line
        if (/[A-Za-z]{2,}/.test(w) && !/^\(D\)$/.test(w)) next = undefined;
    }
    return out;
}

// #endregion

// #region the search

const isSan = (pos: Position, move: Move, san: string) =>
    makeSan(pos, move).replace(/[+#]$/, "") === san;

/** The legal moves a move in the text may be. */
function candidates(pos: Position, t: TextMove): Move[] {
    const out: Move[] = [];
    for (const [from, dests] of pos.allDests()) {
        const piece = pos.board.get(from)!;
        for (const to of dests) {
            const move = { from, to };
            if (t.castle) {
                if (piece.role === "king" && isSan(pos, move, t.castle))
                    out.push(move);
                continue;
            }
            if (to !== t.to) continue;
            const target = pos.board.get(to);
            if (target && target.color === pos.turn) continue; // castling as king takes rook
            const captures =
                !!target || (piece.role === "pawn" && (from & 7) !== (to & 7));
            if (t.capture && !captures) continue;
            if (t.pawn) {
                if (piece.role !== "pawn") continue;
                if (t.pawn.file !== undefined && (from & 7) !== t.pawn.file)
                    continue;
                if (t.pawn.file === undefined && captures) continue;
                const last = to >> 3 === 0 || to >> 3 === 7;
                out.push(last ? { ...move, promotion: "queen" } : move);
                continue;
            }
            if (piece.role === "pawn") continue;
            if (t.role && piece.role !== t.role) continue;
            out.push(move);
        }
    }
    return out;
}

/**
 * Moves from the start of the game, taken from the text in order, that reach the diagram's
 * board (`boardFen`, the first field of a FEN); undefined if the text has none. Each ply comes
 * from a move numbered as that ply, later in the text than the one before.
 */
export function gameBefore(text: string, boardFen: string): Move[] | undefined {
    const list = textMoves(text);
    const start = Chess.default();
    if (makeBoardFen(start.board) === boardFen) return undefined;
    const target = parseBoardFen(boardFen);
    if (target.isErr) return undefined;
    const goal = target.value;
    // pieces captured don't come back (promotions aside): fewer than the diagram's is a dead end
    const counts = (board: Board) =>
        COLORS.flatMap((c) => ROLE_LIST.map((r) => board.pieces(c, r).size()));
    const needed = counts(goal);
    /**
     * Whether the diagram can still follow: no fewer pieces of a kind than it has, and its
     * pawns within reach of ours (pawns never go back), with no more strays than captures
     * could remove.
     */
    const possible = (pos: Position) => {
        if (!counts(pos.board).every((n, i) => n >= needed[i])) return false;
        for (const color of COLORS) {
            const up = color === "white" ? 1 : -1;
            const reaches = (from: Square, to: Square) => {
                const ranks = ((to >> 3) - (from >> 3)) * up;
                return ranks >= 0 && Math.abs((to & 7) - (from & 7)) <= ranks;
            };
            const ours = [...pos.board.pieces(color, "pawn")];
            const theirs = [...goal.pieces(color, "pawn")];
            if (!theirs.every((t) => ours.some((o) => reaches(o, t))))
                return false;
            const strays = ours.filter(
                (o) => !theirs.some((t) => reaches(o, t)),
            );
            if (strays.length > ours.length - theirs.length) return false;
        }
        return true;
    };
    /** Squares where a board differs from the diagram's: moves closer to it are tried first. */
    const distance = (board: Board) => {
        let n = 0;
        for (let sq = 0; sq < 64; sq++) {
            const a = board.get(sq);
            const b = goal.get(sq);
            if (a?.role !== b?.role || a?.color !== b?.color) n++;
        }
        return n;
    };
    const byPly = new Map<number, number[]>();
    list.forEach((t, i) => byPly.set(t.ply, [...(byPly.get(t.ply) ?? []), i]));

    // ply by ply, the positions the text can reach, each kept at the earliest point in the text
    // it was reached from (later is never better), the closest to the diagram first
    type State = { pos: Position; after: number; moves: Move[]; rank: number };
    let layer: State[] = [{ pos: start, after: -1, moves: [], rank: 0 }];
    for (let ply = 0; ply < MAX_PLY && layer.length; ply++) {
        const next = new Map<string, State>();
        for (const state of layer) {
            for (const i of byPly.get(ply + 1) ?? []) {
                if (i <= state.after) continue;
                for (const move of candidates(state.pos, list[i])) {
                    const pos = state.pos.clone();
                    pos.play(move);
                    const board = makeBoardFen(pos.board);
                    if (board === boardFen) return [...state.moves, move];
                    const known = next.get(board);
                    if ((known && known.after <= i) || !possible(pos)) continue;
                    next.set(board, {
                        pos,
                        after: i,
                        moves: [...state.moves, move],
                        rank: distance(pos.board),
                    });
                }
            }
        }
        layer = [...next.values()]
            .sort((a, b) => a.rank - b.rank || a.after - b.after)
            .slice(0, BEAM);
    }
    return undefined;
}

// #endregion
