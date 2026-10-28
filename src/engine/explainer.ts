// The explainer (P2.8 R4): a second instance of the analysis engine, in the background, that
// runs the short threat searches behind "It stops …" and "It threatens …" (threatsearch.ts),
// so the main analysis is never interrupted. One request at a time, results cached by
// position and move. Started on the first request, kept for the session.

import anylogger from "anylogger";
import { analysisProfile, startEngine } from "./engineprofiles";
import {
    AnalysisOptions,
    EngineInfo,
    IChessEngine,
    PositionHistory,
} from "./engineinterfaces";
import { searchOnce, SearchResult } from "./search";
import { moveThreats, MoveThreats } from "./threatsearch";
import { isEvalEnd, parsePieceValues, PieceValues } from "./piecevalues";
const log = anylogger("explainer");

let engine: { profileId: string; started: Promise<IChessEngine> } | undefined;
let queue: Promise<unknown> = Promise.resolve();
const threatCache = new Map<string, Promise<MoveThreats | undefined>>();
/**
 * Deep enough to see a tactic through, short enough to answer within a second or two. MultiPV
 * is given every time: the engine keeps the last value it was sent (the tutor sends more)
 */
const LINE_SEARCH: AnalysisOptions = { depth: 16, movetime: 1500, multipv: 1 };

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

/**
 * One search by the explainer engine, queued behind the others and not cached (the tutor's
 * multi-line searches: each position is searched when it comes up). Lines are scored from
 * White's point of view, as searchOnce gives them.
 */
export function explainerSearch(
    fen: string,
    options: AnalysisOptions,
): Promise<SearchResult | undefined> {
    return enqueue(new Map(), fen, (engine) =>
        searchOnce(engine, fen, options),
    );
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
    /** The game behind each position, so repetitions count (gamehistory.ts) */
    games?: { before?: PositionHistory; after?: PositionHistory },
): Promise<MoveLines | undefined> {
    // the same positions reached by another game may count repetitions differently
    const key = `${fenBefore} ${fenAfter} ${games?.before?.moves.join(",") ?? ""}`;
    return enqueue(lineCache, key, async (engine) => {
        const pvAt = async (fen: string, history?: PositionHistory) =>
            (await searchOnce(engine, fen, { ...LINE_SEARCH, history }))
                .lines[0]?.pv;
        return {
            bestPv: await pvAt(fenBefore, games?.before),
            replyPv: await pvAt(fenAfter, games?.after),
        };
    });
}

const alternativesCache = new Map<string, Promise<EngineInfo[] | undefined>>();

/**
 * The engine's two best lines in `fen` (MultiPV 2), scored from White's side: whether its best
 * move is the only good one (reasons/onlymove.ts).
 */
export function explainAlternatives(
    fen: string,
    /** The game behind the position, so repetitions count (gamehistory.ts) */
    history?: PositionHistory,
): Promise<EngineInfo[] | undefined> {
    const key = `${fen} ${history?.moves.join(",") ?? ""}`;
    return enqueue(
        alternativesCache,
        key,
        async (engine) =>
            (
                await searchOnce(engine, fen, {
                    ...LINE_SEARCH,
                    multipv: 2,
                    history,
                })
            ).lines,
    );
}

const valuesCache = new Map<string, Promise<PieceValues | undefined>>();
/** `eval` answers in milliseconds; past this, the engine is taken not to have it */
const EVAL_TIMEOUT = 2000;

/**
 * Stockfish's NNUE piece values in `fen` (piecevalues.ts); undefined for other engines.
 */
export function explainPieceValues(
    fen: string,
): Promise<PieceValues | undefined> {
    return enqueue(valuesCache, fen, (engine) => {
        const name = engine.getId()?.name ?? "";
        if (!engine.evaluate || !/stockfish/i.test(name))
            return Promise.resolve(undefined);
        return new Promise<PieceValues | undefined>((resolve) => {
            const lines: string[] = [];
            const done = () => {
                clearTimeout(timer);
                engine.off("line", onLine);
                resolve(parsePieceValues(lines));
            };
            const onLine = (line: string) => {
                lines.push(line);
                if (isEvalEnd(line)) done();
            };
            const timer = setTimeout(done, EVAL_TIMEOUT);
            engine.on("line", onLine);
            engine.evaluate!(fen);
        });
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
