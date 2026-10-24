// "What if I play this?": how a move compares with the engine's choice, and where the engine's
// line leads afterwards.

import { Chess, Color, opposite, parseUci, Position, Role } from "chessops";
import { parseFen } from "chessops/fen";
import { makeSanAndPlay } from "chessops/san";
import { Evaluation } from "chessops/pgn";
import { Score } from "../engine/engineinterfaces";
import { EvaluationExt, Path } from "./pgn";
import { ReviewedMove, reviewLine } from "./review";

const VALUES: Record<Role, number> = {
    pawn: 1,
    knight: 3,
    bishop: 3,
    rook: 5,
    queen: 9,
    king: 0,
};

/** Material of `color` minus the opponent's, in pawns. */
export function materialBalance(pos: Position, color: Color): number {
    let total = 0;
    for (const square of pos.board.occupied) {
        const piece = pos.board.get(square)!;
        total += (piece.color === color ? 1 : -1) * VALUES[piece.role];
    }
    return total;
}

export const scoreToEvaluation = (
    score: Score,
    bestUci?: string,
): EvaluationExt =>
    score.type === "cp"
        ? { pawns: score.value / 100, ext: bestUci }
        : { mate: score.value, ext: bestUci };

const positionOf = (fen: string) => {
    const setup = parseFen(fen);
    const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    return pos?.isOk ? pos.value : undefined;
};

/**
 * Judges the move from `beforeFen` to `afterFen` with the review rules. Scores are from
 * White's point of view; `bestUci` is the engine's choice before the move.
 */
export function judgeMove(
    beforeFen: string,
    before: Evaluation & { ext?: string },
    afterFen: string,
    after: Evaluation,
    san: string,
): ReviewedMove | undefined {
    const posBefore = positionOf(beforeFen);
    const posAfter = positionOf(afterFen);
    if (!posBefore || !posAfter) return undefined;
    return reviewLine([
        {
            turn: posBefore.turn,
            pos: posBefore,
            evaluation: before,
            fen: beforeFen,
            path: Path.root,
        },
        {
            turn: posAfter.turn,
            pos: posAfter,
            evaluation: after,
            fen: afterFen,
            path: Path.root,
            san,
            ply: 1,
        },
    ])[0];
}

export type LineOutcome = {
    /** The moves considered, in SAN */
    sans: string[];
    /** The side the material change is counted for */
    side: Color;
    /** Material change for `side` once the captures in the line are over */
    materialChange: number;
    /** The side checkmated at the end of the line, if any */
    mated?: Color;
};

/**
 * Plays the engine line from `fen` and measures the material for `side` where it settles: after
 * `plies` moves, extended while captures continue so an exchange is not cut in half.
 */
export function lineOutcome(
    fen: string,
    pv: string[],
    side: Color,
    plies = 6,
): LineOutcome | undefined {
    const pos = positionOf(fen);
    if (!pos) return undefined;
    const start = materialBalance(pos, side);
    const sans: string[] = [];
    for (const uci of pv) {
        const move = parseUci(uci);
        if (!move || !pos.isLegal(move)) break;
        const capture = "from" in move && pos.board.has(move.to);
        if (sans.length >= plies && !capture) break;
        sans.push(makeSanAndPlay(pos, move));
        if (sans.length >= plies + 4) break;
    }
    return {
        sans,
        side,
        materialChange: materialBalance(pos, side) - start,
        mated: pos.isCheckmate() ? pos.turn : undefined,
    };
}

const SIDE = { white: "White", black: "Black" };

/** "Black wins material (+3)", "White mates", "Material stays level". */
export function describeOutcome(outcome: LineOutcome): string {
    const side = outcome.side;
    if (outcome.mated) return `${SIDE[opposite(outcome.mated)]} mates`;
    const delta = outcome.materialChange;
    if (delta >= 1) return `${SIDE[side]} wins material (+${delta})`;
    if (delta <= -1)
        return `${SIDE[opposite(side)]} wins material (+${-delta})`;
    return "Material stays level";
}
