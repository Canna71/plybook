// The only good move (P2.4h, from Chesserly's "Great": docs/EXPLANATIONS.md): the engine's best
// move beats every other by a wide margin of winning chances. An engine fact read from its two
// best lines (MultiPV 2), not a rule's reading of the position. Pure, for tests.

import { Chess, Color, opposite, parseUci } from "chessops";
import { parseFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import type { EngineInfo } from "../engine/engineinterfaces";
import { scoreWin } from "../models/review";

/** Winning chances (%) the second-best move must give away for the best to be the only one */
export const ONLY_MOVE_GAP = 10;

export type OnlyMove = {
    best: { uci: string; san: string };
    second: { uci: string; san: string };
    /** Winning chances the second-best move gives away against the best, in % */
    gap: number;
    /** What the best move keeps, for the side to move */
    keeps: "mate" | "advantage" | "balance" | "damage";
    /** The shallower of the two lines' depths */
    depth?: number;
};

const positionOf = (fen: string) => {
    const setup = parseFen(fen);
    const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    return pos?.isOk ? pos.value : undefined;
};

/**
 * Whether the engine's best move in `fenBefore` is its only good one. `lines`: the engine's
 * lines there by MultiPV order, scored from White's side (searchOnce). `previousFen`: the
 * position before the opponent's last move, to tell a recapture. Not for a recapture or for
 * taking a piece nothing defends: there the only move is plain to see.
 */
export function onlyMove(
    fenBefore: string,
    lines: EngineInfo[],
    previousFen?: string,
): OnlyMove | undefined {
    const pos = positionOf(fenBefore);
    const [first, second] = lines;
    const bestUci = first?.pv?.[0];
    const secondUci = second?.pv?.[0];
    if (!pos || !first?.score || !second?.score || !bestUci || !secondUci)
        return undefined;
    const best = parseUci(bestUci);
    const next = parseUci(secondUci);
    if (!best || !next || !("from" in best) || !pos.isLegal(best))
        return undefined;
    if (!pos.isLegal(next)) return undefined;
    const me: Color = pos.turn;
    const them = opposite(me);
    const win = (info: EngineInfo) => scoreWin(info.score!, me, me);
    const gap = win(first) - win(second);
    if (gap < ONLY_MOVE_GAP) return undefined;

    // a capture: taking back what was just taken, or a piece left undefended
    const taken = pos.board.get(best.to);
    if (taken?.color === them) {
        const previous = previousFen ? positionOf(previousFen) : undefined;
        if (previous?.board.get(best.to)?.color === me) return undefined;
        const defenders = pos.kingAttackers(best.to, them, pos.board.occupied);
        if (defenders.isEmpty()) return undefined;
    }

    const mates = first.score.type === "mate" && win(first) > 50;
    const kept = win(first);
    const depths = [first.depth, second.depth].filter(
        (d): d is number => d !== undefined,
    );
    return {
        best: { uci: bestUci, san: makeSan(pos, best) },
        second: { uci: secondUci, san: makeSan(pos, next) },
        gap,
        keeps: mates
            ? "mate"
            : kept >= 65
              ? "advantage"
              : kept >= 35
                ? "balance"
                : "damage",
        depth: depths.length ? Math.min(...depths) : undefined,
    };
}

/** "keeps the balance", for "the only move that …" */
export const keepsWords: Record<OnlyMove["keeps"], string> = {
    mate: "keeps a forced mate",
    advantage: "keeps the advantage",
    balance: "keeps the balance",
    damage: "limits the damage",
};

/** "kept the balance", for "Only Nf5 …" after another move was played */
export const keptWords: Record<OnlyMove["keeps"], string> = {
    mate: "kept a forced mate",
    advantage: "kept the advantage",
    balance: "kept the balance",
    damage: "limited the damage",
};
