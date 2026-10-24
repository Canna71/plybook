// Game review maths, following Lichess (lila: WinPercent, AccuracyPercent, Advice).
// Evaluations in ReChess PGNs are stored from White's point of view.

import { Color, Position } from "chessops";
import { parseUci } from "chessops/util";
import { makeSan } from "chessops/san";
import { INITIAL_FEN } from "chessops/fen";
import { Evaluation, isMate } from "chessops/pgn";
import { EvaluationExt, Path } from "./pgn";
import type { GameModel } from "./GameModel";
import type { Score } from "../engine/engineinterfaces";

export type MoveClass = "best" | "good" | "inaccuracy" | "mistake" | "blunder";

/** Win-percentage points lost: Lichess uses 0.1 / 0.2 / 0.3 winning chances (on -1..1). */
const THRESHOLDS: [MoveClass, number][] = [
    ["blunder", 15],
    ["mistake", 10],
    ["inaccuracy", 5],
];

/** The NAG review writes for each class ("?!", "?", "??"). */
export const CLASS_NAGS: Partial<Record<MoveClass, number>> = {
    inaccuracy: 6,
    mistake: 2,
    blunder: 4,
};

/** A position in the reviewed line: the initial one or the one after a move. */
export type ReviewNode = {
    /** Side to move in this position */
    turn: Color;
    pos: Position;
    evaluation?: EvaluationExt;
    fen?: string;
    path: Path;
    san?: string;
    ply?: number;
};

export type ReviewedMove = {
    path: Path;
    ply: number;
    san: string;
    color: Color;
    /** Win % for the side that moved, before and after the move */
    winBefore: number;
    winAfter: number;
    loss: number;
    accuracy: number;
    class: MoveClass;
    /** The engine's choice in the position before the move, in SAN and UCI */
    bestSan?: string;
    bestUci?: string;
    /** The position before the move */
    fenBefore?: string;
};

/**
 * Centipawns from White's point of view. Mates count as a large, distance-dependent score;
 * mate 0 means the side to move is checkmated.
 */
export function whiteCp(evaluation: Evaluation, turn: Color): number {
    if (isMate(evaluation)) {
        if (evaluation.mate === 0) return turn === "white" ? -10000 : 10000;
        const sign = Math.sign(evaluation.mate);
        return sign * (21 - Math.min(10, Math.abs(evaluation.mate))) * 100;
    }
    return evaluation.pawns * 100;
}

/** Lichess win %: 50 at equality, about 75 at +2 pawns, capped at +-10 pawns. */
export function winPercent(cp: number): number {
    const clamped = Math.max(-1000, Math.min(1000, cp));
    return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * clamped)) - 1);
}

/** Win % for `color` from an engine score given from White's point of view, in a position
 * where `turn` is to move (needed for mate 0). */
export function scoreWin(score: Score, turn: Color, color: Color): number {
    const evaluation: Evaluation =
        score.type === "cp"
            ? { pawns: score.value / 100 }
            : { mate: score.value };
    const white = winPercent(whiteCp(evaluation, turn));
    return color === "white" ? white : 100 - white;
}

/** Lichess move accuracy from the mover's win % before and after the move. */
export function moveAccuracy(winBefore: number, winAfter: number): number {
    const raw =
        103.1668100711649 *
            Math.exp(-0.04354415386753951 * (winBefore - winAfter)) -
        3.166924740191411;
    // +1: uncertainty bonus, as on Lichess
    return Math.max(0, Math.min(100, raw + 1));
}

export function classify(loss: number, isBest: boolean): MoveClass {
    if (isBest) return "best";
    for (const [cls, threshold] of THRESHOLDS) {
        if (loss >= threshold) return cls;
    }
    return "good";
}

/** White's usual edge in the starting position, which exports never evaluate. */
const START_EVALUATION: Evaluation = { pawns: 0.2 };

const isStandardStart = (fen?: string) =>
    !!fen &&
    fen.split(" ").slice(0, 4).join(" ") ===
        INITIAL_FEN.split(" ").slice(0, 4).join(" ");

/** Positions that need no engine: the standard start and the end of the game. */
function evaluationOf(node: ReviewNode): Evaluation | undefined {
    if (node.evaluation) return node.evaluation;
    if (node.path.empty() && isStandardStart(node.fen)) return START_EVALUATION;
    if (node.pos.isCheckmate()) return { mate: 0 };
    if (node.pos.isEnd()) return { pawns: 0 };
}

function whiteWin(node: ReviewNode) {
    const evaluation = evaluationOf(node);
    return evaluation && winPercent(whiteCp(evaluation, node.turn));
}

function bestSanOf(node: ReviewNode) {
    const uci = node.evaluation?.ext;
    const move = typeof uci === "string" ? parseUci(uci) : undefined;
    return move && node.pos.isLegal(move) ? makeSan(node.pos, move) : undefined;
}

/** Mate distance for `color` (negative: `color` gets mated), or undefined without a mate. */
function mateFor(evaluation: Evaluation, turn: Color, color: Color) {
    if (!isMate(evaluation)) return undefined;
    // mate 0: the side to move is already checkmated
    const whiteMate =
        evaluation.mate === 0 ? (turn === "white" ? -1 : 1) : evaluation.mate;
    return color === "white" ? whiteMate : -whiteMate;
}

/**
 * Lichess's rules for forced mates, which override the win % classes: allowing a mate, or
 * letting one slip, is graded by how good the position is without it.
 */
function mateClass(
    before: Evaluation,
    beforeTurn: Color,
    after: Evaluation,
    afterTurn: Color,
    color: Color,
): MoveClass | undefined {
    const mateBefore = mateFor(before, beforeTurn, color);
    const mateAfter = mateFor(after, afterTurn, color);
    const sign = color === "white" ? 1 : -1;
    if (mateBefore === undefined && mateAfter !== undefined && mateAfter < 0) {
        const cp = sign * whiteCp(before, beforeTurn);
        return cp < -999 ? "inaccuracy" : cp < -700 ? "mistake" : "blunder";
    }
    if (mateBefore !== undefined && mateBefore > 0) {
        if (mateAfter === undefined) {
            const cp = sign * whiteCp(after, afterTurn);
            return cp > 999 ? "inaccuracy" : cp > 700 ? "mistake" : "blunder";
        }
        if (mateAfter < 0) return "blunder";
    }
}

/**
 * Reviews a line given as its positions, starting with the one before the first move.
 * Moves whose before or after position has no evaluation are skipped.
 */
export function reviewLine(nodes: ReviewNode[]): ReviewedMove[] {
    const moves: ReviewedMove[] = [];
    for (let i = 1; i < nodes.length; i++) {
        const before = nodes[i - 1];
        const after = nodes[i];
        const evBefore = evaluationOf(before);
        const evAfter = evaluationOf(after);
        if (!evBefore || !evAfter || !after.san) continue;

        const color = before.turn;
        const wb = winPercent(whiteCp(evBefore, before.turn));
        const wa = winPercent(whiteCp(evAfter, after.turn));
        const winBefore = color === "white" ? wb : 100 - wb;
        const winAfter = color === "white" ? wa : 100 - wa;
        const loss = Math.max(0, winBefore - winAfter);
        const bestSan = bestSanOf(before);
        const isBest = bestSan === after.san;
        moves.push({
            path: after.path,
            ply: after.ply ?? i,
            san: after.san,
            color,
            winBefore,
            winAfter,
            loss,
            accuracy: moveAccuracy(winBefore, winAfter),
            class: isBest
                ? "best"
                : (mateClass(
                      evBefore,
                      before.turn,
                      evAfter,
                      after.turn,
                      color,
                  ) ?? classify(loss, false)),
            bestSan,
            bestUci: bestSan ? (before.evaluation?.ext as string) : undefined,
            fenBefore: before.fen,
        });
    }
    return moves;
}

/** The initial position and every position of the mainline, in order. */
export const mainline = (game: GameModel): ReviewNode[] => [
    { ...game.initial, path: Path.root },
    ...game.mainline,
];

/** White's win % for every evaluated position of the line, for the graph. */
export const winCurve = (nodes: ReviewNode[]) =>
    nodes.map((node) => ({ path: node.path, win: whiteWin(node) }));

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function stdDev(xs: number[]) {
    const m = mean(xs);
    return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

/**
 * Lichess game accuracy: the average of a volatility-weighted mean and the harmonic mean of
 * the move accuracies, so a few big blunders weigh more than in a plain average.
 */
export function gameAccuracy(
    moves: ReviewedMove[],
): Record<Color, number | undefined> {
    const result: Record<Color, number | undefined> = {
        white: undefined,
        black: undefined,
    };
    if (moves.length === 0) return result;

    // Win % before each move plus after the last one, from White's point of view
    const wins = [
        ...moves.map((m) =>
            m.color === "white" ? m.winBefore : 100 - m.winBefore,
        ),
        (({ color, winAfter }) =>
            color === "white" ? winAfter : 100 - winAfter)(
            moves[moves.length - 1],
        ),
    ];
    const windowSize = Math.max(2, Math.min(8, Math.floor(moves.length / 10)));
    const windows = [
        ...Array(Math.max(0, windowSize - 2)).fill(wins.slice(0, windowSize)),
        ...wins
            .slice(0, wins.length - windowSize + 1)
            .map((_, i) => wins.slice(i, i + windowSize)),
    ].slice(0, moves.length);
    const weights = windows.map((w) => Math.max(0.5, Math.min(12, stdDev(w))));

    for (const color of ["white", "black"] as Color[]) {
        const own = moves
            .map((m, i) => ({ m, w: weights[i] ?? 1 }))
            .filter(({ m }) => m.color === color);
        if (own.length === 0) continue;
        const weighted =
            own.reduce((s, { m, w }) => s + m.accuracy * w, 0) /
            own.reduce((s, { w }) => s + w, 0);
        const harmonic =
            own.length /
            own.reduce((s, { m }) => s + 1 / Math.max(m.accuracy, 0.01), 0);
        result[color] = (weighted + harmonic) / 2;
    }
    return result;
}

/** Inaccuracies, mistakes and blunders, in game order. */
export const keyMoments = (moves: ReviewedMove[]) =>
    moves.filter((m) => CLASS_NAGS[m.class] !== undefined);
