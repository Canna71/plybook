import { AnalysisOptions, EngineInfo, IChessEngine } from "./engineinterfaces";

export type SearchResult = {
    /** The last info of each line, by MultiPV order; scores from White's point of view */
    lines: EngineInfo[];
    bestmove?: string;
};

/**
 * Runs one search to its end. The engine must not be searching anything else: callers stop a
 * running search and await it before starting the next.
 */
export function searchOnce(
    engine: IChessEngine,
    fen: string,
    options: AnalysisOptions,
): Promise<SearchResult> {
    const blackToMove = fen.split(" ")[1] === "b";
    const lines: EngineInfo[] = [];
    return new Promise((resolve) => {
        const onInfo = (info: EngineInfo) => {
            if (!info.pv?.length || !info.score) return;
            const score = blackToMove
                ? { ...info.score, value: -info.score.value }
                : info.score;
            lines[(info.multipv ?? 1) - 1] = { ...info, score };
        };
        const onBestMove = (bestmove: string) => {
            engine.off("info", onInfo);
            engine.off("bestmove", onBestMove);
            resolve({
                lines: lines.filter(Boolean),
                bestmove:
                    bestmove && bestmove !== "(none)" && bestmove !== "0000"
                        ? bestmove
                        : undefined,
            });
        };
        engine.on("info", onInfo);
        engine.on("bestmove", onBestMove);
        engine.analyzeFromFenOrMoves(fen, options);
    });
}
