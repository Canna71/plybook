// Guess the move with candidate moves: at each of one side's turns the player names up to three
// candidates before the game move and the engine's choice are revealed.

import { Chess, Color, parseUci } from "chessops";
import { parseFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import { Score } from "../engine/engineinterfaces";
import type { GameModel } from "./GameModel";
import { scoreWin } from "./review";

export const MAX_CANDIDATES = 3;
/** A candidate this close to the best line (win-percentage points) counts as finding the best */
export const BEST_TOLERANCE = 2;

export type GuessTurn = {
    ply: number;
    fenBefore: string;
    /** The move played in the game */
    played: { uci: string; san: string };
};

/** The mainline turns where `side` moves. */
export function guessTurns(game: GameModel, side: Color): GuessTurn[] {
    const turns: GuessTurn[] = [];
    let fenBefore = game.initial.fen;
    let turn = game.initial.turn;
    for (const ply of game.mainline) {
        if (turn === side) {
            turns.push({
                ply: ply.ply,
                fenBefore,
                played: { uci: ply.uci, san: ply.san },
            });
        }
        fenBefore = ply.fen;
        turn = ply.turn;
    }
    return turns;
}

const positionOf = (fen: string) => {
    const setup = parseFen(fen);
    const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    return pos?.isOk ? pos.value : undefined;
};

/** SAN of a move in `fen`, or undefined if it is not legal there. */
export function sanOf(fen: string, uci: string): string | undefined {
    const pos = positionOf(fen);
    const move = parseUci(uci);
    return pos && move && pos.isLegal(move) ? makeSan(pos, move) : undefined;
}

/** Adds a legal, new candidate while there is room. */
export function addCandidate(fen: string, candidates: string[], uci: string) {
    if (candidates.length >= MAX_CANDIDATES || candidates.includes(uci)) {
        return candidates;
    }
    return sanOf(fen, uci) ? [...candidates, uci] : candidates;
}

export type CandidateResult = {
    uci: string;
    san: string;
    score?: Score;
    /** Win-percentage points lost against the engine's best */
    loss?: number;
    isCandidate: boolean;
    isPlayed: boolean;
    isBest: boolean;
};

export type TurnResult = {
    ply: number;
    moves: CandidateResult[];
    playedSan: string;
    bestSan?: string;
    foundBest: boolean;
    foundPlayed: boolean;
};

/**
 * Judges the candidates against the engine. `best` is the engine's free search; `scores` holds
 * the scores of the candidates and the game move (a search restricted to them). Scores are from
 * White's point of view.
 */
export function judgeTurn(
    turn: GuessTurn,
    candidates: string[],
    best: { uci: string; score: Score } | undefined,
    scores: Map<string, Score>,
): TurnResult {
    const side: Color =
        turn.fenBefore.split(" ")[1] === "b" ? "black" : "white";
    const ucis = [...new Set([...candidates, turn.played.uci])];
    const moves = ucis.map((uci): CandidateResult => {
        const score = uci === best?.uci ? best.score : scores.get(uci);
        const loss =
            best && score
                ? Math.max(
                      0,
                      scoreWin(best.score, side, side) -
                          scoreWin(score, side, side),
                  )
                : undefined;
        return {
            uci,
            san: sanOf(turn.fenBefore, uci) ?? uci,
            score,
            loss,
            isCandidate: candidates.includes(uci),
            isPlayed: uci === turn.played.uci,
            isBest:
                uci === best?.uci ||
                (loss !== undefined && loss < BEST_TOLERANCE),
        };
    });
    return {
        ply: turn.ply,
        moves: moves.sort((a, b) => (a.loss ?? 100) - (b.loss ?? 100)),
        playedSan: turn.played.san,
        bestSan: best && sanOf(turn.fenBefore, best.uci),
        foundBest: moves.some((m) => m.isCandidate && m.isBest),
        foundPlayed: candidates.includes(turn.played.uci),
    };
}

export function summary(results: TurnResult[]) {
    return {
        turns: results.length,
        foundBest: results.filter((r) => r.foundBest).length,
        foundPlayed: results.filter((r) => r.foundPlayed).length,
    };
}
