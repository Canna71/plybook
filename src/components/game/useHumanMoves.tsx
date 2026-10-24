import { Accessor, createEffect, createSignal, on, onCleanup } from "solid-js";
import anylogger from "anylogger";
import { humanProfile, startEngine } from "../../engine/engineprofiles";
import { IChessEngine } from "../../engine/engineinterfaces";
import { MoveStat, parseMoveStat, topMoves } from "../../engine/lc0";
const log = anylogger("humanmoves");

/**
 * Runs the Maia-style profile next to the analysis engine and returns the moves players of its
 * rating most often choose in `fen`. Idle (no process) while `fen` is undefined.
 */
export function useHumanMoves(fen: Accessor<string | undefined>) {
    const [moves, setMoves] = createSignal<MoveStat[]>([]);
    let engine: IChessEngine | undefined;
    let starting: Promise<IChessEngine | undefined> | undefined;
    let engineProfileId: string | undefined;
    // stats of the running search; searches answered after a newer one started are stale
    let stats: MoveStat[] = [];
    let pending = 0;

    const onString = (text: string) => {
        const stat = parseMoveStat(text);
        if (stat) stats.push(stat);
    };
    const onBestMove = () => {
        pending = Math.max(0, pending - 1);
        if (pending === 0) setMoves(topMoves(stats));
        stats = [];
    };

    const stop = () => {
        engine?.quit();
        engine = undefined;
        starting = undefined;
        engineProfileId = undefined;
        pending = 0;
        stats = [];
        setMoves([]);
    };

    const ensureEngine = () => {
        const profile = humanProfile();
        if (!profile) return undefined;
        if (engineProfileId !== profile.id) {
            stop();
            engineProfileId = profile.id;
            starting = startEngine(profile)
                .then((started) => {
                    // stopped or switched while it was starting
                    if (engineProfileId !== profile.id) {
                        started.quit();
                        return undefined;
                    }
                    started.setOption("VerboseMoveStats", true);
                    started.on("string", onString);
                    started.on("bestmove", onBestMove);
                    engine = started;
                    return started;
                })
                .catch((err) => {
                    log.warn("human-move engine failed to start", err);
                    return undefined;
                });
        }
        return starting;
    };

    createEffect(
        on([fen, humanProfile], async ([position]) => {
            if (!position) {
                stop();
                return;
            }
            const eng = await ensureEngine();
            if (!eng || fen() !== position) return;
            setMoves([]);
            stats = [];
            pending++;
            eng.analyzeFromFenOrMoves(position, { nodes: 1, multipv: 1 });
        }),
    );

    onCleanup(stop);

    return {
        humanMoves: moves,
        humanProfileName: () => humanProfile()?.name,
    };
}
