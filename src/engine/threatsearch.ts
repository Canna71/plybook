// The two short searches that explain a move in chess terms (P2.8 R2, docs/REASONS.md): the
// opponent's threat in the null-move position before the move (did the move stop it?) and our
// own after it (what does the move threaten?). Short on purpose: a threat is a few moves deep.

import { nullMoveFen } from "../models/threat";
import {
    createdThreat,
    isProphylaxis,
    LineIdea,
    playUci,
    Prevented,
    preventedMove,
    stoppedThreat,
} from "../reasons/threats";
import { AnalysisOptions, IChessEngine } from "./engineinterfaces";
import { searchOnce } from "./search";

export const THREAT_SEARCH: AnalysisOptions = { depth: 12, movetime: 500 };

export type MoveThreats = {
    /** The opponent's threat the move stopped */
    stopped?: LineIdea;
    /** What the move threatens next */
    created?: LineIdea;
    /** No threat stopped, but the opponent's wanted move taken away by a pawn (prophylaxis) */
    prevented?: Prevented;
};

/**
 * Runs the two searches one after the other. Like searchOnce, the engine must be idle: callers
 * stop and await anything it is running first.
 */
export async function moveThreats(
    engine: IChessEngine,
    fenBefore: string,
    uci: string,
    replyPv?: string[],
    options: AnalysisOptions = THREAT_SEARCH,
): Promise<MoveThreats> {
    const pvAt = async (fen: string | undefined) =>
        fen
            ? ((await searchOnce(engine, fen, options)).lines[0]?.pv ?? [])
            : [];
    const after = playUci(fenBefore, uci);
    if (!after) return {};
    const theirs = await pvAt(nullMoveFen(fenBefore));
    const ours = await pvAt(nullMoveFen(after));
    const stopped = theirs.length
        ? stoppedThreat(fenBefore, uci, theirs, replyPv)
        : undefined;
    const prevented =
        !stopped && theirs.length
            ? preventedMove(fenBefore, uci, theirs[0])
            : undefined;
    return {
        stopped,
        created: ours.length ? createdThreat(fenBefore, uci, ours) : undefined,
        prevented: isProphylaxis(prevented) ? prevented : undefined,
    };
}
