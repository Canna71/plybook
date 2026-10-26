// The explainer (P2.8 R4): a second instance of the analysis engine, in the background, that
// runs the short threat searches behind "It stops …" and "It threatens …" (threatsearch.ts),
// so the main analysis is never interrupted. One request at a time, results cached by
// position and move. Started on the first request, kept for the session.

import anylogger from "anylogger";
import { analysisProfile, startEngine } from "./engineprofiles";
import { AnalysisOptions, IChessEngine } from "./engineinterfaces";
import { searchOnce } from "./search";
import { moveThreats, MoveThreats } from "./threatsearch";
const log = anylogger("explainer");

let engine: { profileId: string; started: Promise<IChessEngine> } | undefined;
let queue: Promise<unknown> = Promise.resolve();
const threatCache = new Map<string, Promise<MoveThreats | undefined>>();
/** Deep enough to see a tactic through, short enough to answer within a second or two */
const LINE_SEARCH: AnalysisOptions = { depth: 16, movetime: 1500 };

/** The explainer engine for the current analysis profile, started once. */
function explainerEngine(): Promise<IChessEngine> | undefined {
    const profile = analysisProfile();
    if (!profile) return undefined;
    if (engine?.profileId !== profile.id) {
        // the analysis engine changed in Settings: start the new one
        void engine?.started.then((e) => e.quit()).catch(() => {});
        engine = {
            profileId: profile.id,
            started: startEngine(profile).then((e) => {
                // in the background: one thread, a small hash
                e.setOption("Threads", "1");
                e.setOption("Hash", "16");
                return e;
            }),
        };
    }
    return engine.started;
}

/** Queues `job` behind the explainer's other searches, cached under `key`. */
function enqueue<T>(
    cache: Map<string, Promise<T | undefined>>,
    key: string,
    job: (engine: IChessEngine) => Promise<T>,
): Promise<T | undefined> {
    const known = cache.get(key);
    if (known) return known;
    const started = explainerEngine();
    if (!started) return Promise.resolve(undefined);
    // one search at a time: each request waits for the ones before it
    const result = queue.then(async () => {
        try {
            return await job(await started);
        } catch (e) {
            log.warn("explainer search failed", e);
            cache.delete(key);
            return undefined;
        }
    });
    queue = result;
    cache.set(key, result);
    return result;
}

export type MoveLines = {
    /** The engine's line before the move, its best move first */
    bestPv?: string[];
    /** The engine's line after the move, the opponent's answer first */
    replyPv?: string[];
};
const lineCache = new Map<string, Promise<MoveLines | undefined>>();

/**
 * The engine lines around a move, for explaining it where none were kept (the game review's
 * key moments): the best line before it and the answer after it.
 */
export function explainLines(
    fenBefore: string,
    fenAfter: string,
): Promise<MoveLines | undefined> {
    return enqueue(lineCache, `${fenBefore} ${fenAfter}`, async (engine) => {
        const pvAt = async (fen: string) =>
            (await searchOnce(engine, fen, LINE_SEARCH)).lines[0]?.pv;
        return { bestPv: await pvAt(fenBefore), replyPv: await pvAt(fenAfter) };
    });
}

/**
 * What `uci` stops and threatens in `fenBefore`; undefined without a full-strength engine.
 * `replyPv`, the engine's answer to the move, judges whether a threat was really stopped.
 */
export function explainThreats(
    fenBefore: string,
    uci: string,
    replyPv?: string[],
): Promise<MoveThreats | undefined> {
    return enqueue(threatCache, `${fenBefore} ${uci}`, (engine) =>
        moveThreats(engine, fenBefore, uci, replyPv),
    );
}
