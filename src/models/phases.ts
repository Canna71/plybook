// Accuracy by phase of the game (P1.6, from the Chesserly study: docs/EXPLANATIONS.md): where a
// player loses most, the opening, the middlegame or the endgame, over their reviewed games.
// Pure: the games are read and reviewed by online/phasestats.ts.

import { Chess, Color } from "chessops";
import { parseFen } from "chessops/fen";
import { isEndgame } from "../reasons/positional";
import { gameAccuracy, ReviewedMove } from "./review";

export type Phase = "opening" | "middlegame" | "endgame";
export const PHASES: Phase[] = ["opening", "middlegame", "endgame"];
export const PHASE_NAMES: Record<Phase, string> = {
    opening: "Opening",
    middlegame: "Middlegame",
    endgame: "Endgame",
};

/** The opening is the first ten moves, unless an endgame comes sooner */
export const OPENING_PLIES = 20;
/** A phase counts in a game only from this many of the player's graded moves: fewer is noise */
export const MIN_PHASE_MOVES = 3;

/**
 * The phase a move was played in: the endgame as P2.4f defines it (no queens, at most four
 * other pieces, reasons/positional.ts), else the opening for the first ten moves, else the
 * middlegame.
 */
export function phaseOf(move: ReviewedMove): Phase {
    const setup = move.fenBefore ? parseFen(move.fenBefore) : undefined;
    const pos = setup?.isOk ? Chess.fromSetup(setup.value) : undefined;
    if (pos?.isOk && isEndgame(pos.value.board)) return "endgame";
    return move.ply <= OPENING_PLIES ? "opening" : "middlegame";
}

/** One game's accuracy in each phase for one side, with how many graded moves it rests on */
export type GamePhases = Record<Phase, { accuracy?: number; moves: number }>;

export function gamePhases(moves: ReviewedMove[], color: Color): GamePhases {
    const phases = moves.map(phaseOf);
    const at = new Map(moves.map((m, i) => [m, phases[i]]));
    const result = {} as GamePhases;
    for (const phase of PHASES) {
        const keep = (m: ReviewedMove) => at.get(m) === phase;
        result[phase] = {
            accuracy: gameAccuracy(moves, keep)[color],
            moves: moves.filter(
                (m) => m.color === color && m.class !== "book" && keep(m),
            ).length,
        };
    }
    return result;
}

/** Each phase's accuracy over many games: the mean of the games where it counts */
export type PhaseTotals = Record<Phase, { accuracy?: number; games: number }>;

export function phaseTotals(games: GamePhases[]): PhaseTotals {
    const result = {} as PhaseTotals;
    for (const phase of PHASES) {
        const counted = games
            .map((g) => g[phase])
            .filter(
                (p): p is { accuracy: number; moves: number } =>
                    p.accuracy !== undefined && p.moves >= MIN_PHASE_MOVES,
            );
        result[phase] = {
            accuracy: counted.length
                ? counted.reduce((s, p) => s + p.accuracy, 0) / counted.length
                : undefined,
            games: counted.length,
        };
    }
    return result;
}
