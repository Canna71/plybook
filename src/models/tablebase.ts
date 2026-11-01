// Endgame tablebase results (Lichess / Syzygy, up to 7 pieces), worded for the user.

import { Color, opposite } from "chessops";

export const MAX_PIECES = 7;

// Mirrors Tablebase in src-tauri/src/net.rs
export type TablebaseMove = {
    uci: string;
    san: string;
    /** From the side to move after this move */
    category: string;
    dtz?: number | null;
    dtm?: number | null;
};

export type Tablebase = {
    /** For the side to move */
    category: string;
    dtz?: number | null;
    dtm?: number | null;
    checkmate: boolean;
    stalemate: boolean;
    moves: TablebaseMove[];
};

export type Outcome = "win" | "draw" | "loss" | "unknown";

/** Pieces on the board of a FEN. */
export const pieceCount = (fen: string) =>
    (fen.split(" ")[0].match(/[a-zA-Z]/g) ?? []).length;

/**
 * What a category means in practice. "Cursed" wins and "blessed" losses are draws under the
 * 50-move rule; "maybe" results are the likely ones when exact data is missing.
 */
export function outcome(category: string): Outcome {
    switch (category) {
        case "win":
        case "maybe-win":
            return "win";
        case "loss":
        case "maybe-loss":
            return "loss";
        case "draw":
        case "cursed-win":
        case "blessed-loss":
            return "draw";
        default:
            return "unknown";
    }
}

/** A move's result for the side that plays it (the API gives it for the opponent). */
export const moveOutcome = (move: TablebaseMove): Outcome => {
    const forOpponent = outcome(move.category);
    return forOpponent === "win"
        ? "loss"
        : forOpponent === "loss"
          ? "win"
          : forOpponent;
};

/** Mate distance in moves, from a DTM in plies. */
const mateIn = (dtm?: number | null) =>
    dtm === null || dtm === undefined
        ? undefined
        : Math.ceil(Math.abs(dtm) / 2);

const SIDE = { white: "White", black: "Black" };

/** "White wins: mate in 11", "Draw", "Black wins". */
export function verdict(tb: Tablebase, turn: Color): string {
    if (tb.checkmate) return `Checkmate: ${SIDE[opposite(turn)]} won`;
    if (tb.stalemate) return "Stalemate: draw";
    const result = outcome(tb.category);
    if (result === "draw") {
        return tb.category === "draw"
            ? "Draw"
            : "Draw with correct play (the 50-move rule saves the defender)";
    }
    if (result === "unknown") return "Result unknown";
    const winner = result === "win" ? turn : opposite(turn);
    // the best move's mate distance when the position's own is not given
    const dtm = tb.dtm ?? tb.moves[0]?.dtm;
    const mate = mateIn(dtm);
    return `${SIDE[winner]} wins${mate ? `: mate in ${mate}` : ""}`;
}

/** "mate in 11", "draw", "loses", for a move list. */
export function moveLabel(move: TablebaseMove): string {
    const result = moveOutcome(move);
    const mate = mateIn(move.dtm);
    switch (result) {
        case "win":
            return mate ? `wins, mate in ${mate}` : "wins";
        case "loss":
            return mate ? `loses, mated in ${mate}` : "loses";
        case "draw":
            return "draws";
        default:
            return "?";
    }
}
