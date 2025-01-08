import { NormalMove } from "chessops";
import { createSignal, createResource, createEffect, batch, onCleanup, Accessor, Signal } from "solid-js";
import { createStore } from "solid-js/store";
import { IChessEngine, EngineInfo } from "../../engine/engineinterfaces";
import { ExecutableUCIInterface } from "../../engine/executableuci";
import { UCIEngine } from "../../engine/uciengine";
import { getEnginePath } from "../../storage/fs";
import { makeMove } from "../common/utils";
import { Color } from "chessground/types";
import { GameModel } from "../../models/GameModel";

export function useChessEngine(options: ChessEngineOptions) {
    // #region Engine state
    const [engineAnalysisOn, setEngineAnalysisOn] = createSignal<boolean>(options.defaultEngineAnalysisOn);
    const [engineFolder, _others] = createResource(() => getEnginePath());
    const [engine, setEngine] = createSignal<IChessEngine | undefined>(
        undefined
    );
    const [engineInfo, setEngineInfo] = createStore<EngineInfo[]>([]);

    const engineCallable = () => engine() && engineAnalysisOn() && engineFolder();

    const shouldInitEngine = () => {
        const shouldInit = (engineAnalysisOn() || options.playingEngine?.()) && engineFolder() && !engine();
        console.log("shouldInitEngine", shouldInit);
        return shouldInit;
    };

    createEffect(async () => {
        if (shouldInitEngine()) {
            const engine = new UCIEngine(
                new ExecutableUCIInterface(engineFolder()!)
            );

            await engine.init();

            engine.on("bestmove", onEngineBestMove);
            engine.on("info", onEngineInfo);
            engine.newGame();
            batch(() => {
                setEngine(engine);
                // setEngineAnalysisOn(true);
            });
        } else {
        }
    });

    
    const cleanup = () => {
        const eng = engine();
        if (eng) {
            console.log("Cleaning up engine");
            eng.quit();
            eng.off("bestmove", onEngineBestMove);
            setEngine(undefined);
        }
    }
    
    createEffect(() => {
        if (!engineAnalysisOn() && !options.playingEngine?.()) {
            cleanup();
        }
    });

    onCleanup(() => {
        cleanup();
    });

    const onEngineBestMove = (bestMove: string, _ponder: string) => {
        const g = options.game();
        if (!g) {
            return;
        }
        if (!options.engineColor?.() || options.engineColor?.() != options.turn()) {
            return;
        }
        const m = { from: bestMove.slice(0, 2), to: bestMove.slice(2, 4) };
        const move: NormalMove = makeMove(m.from, m.to);
        options.applyMove(move);
    };

    const onEngineInfo = (info: EngineInfo) => {
        if (info.multipv) {
            setEngineInfo(info.multipv - 1, info);
        }
    };

    createEffect(() => {
        if (engineCallable()) {
            const fenStr = options.fen();
            setEngineInfo([]);
            engine()!.analyzeFromFenOrMoves(fenStr, { depth: 15, multipv: 3 });
        }
    });

    return {
        engineInfo,
        engineCallable,
        engineAnalysisOnSignal: [engineAnalysisOn, setEngineAnalysisOn] as Signal<boolean>,
    };
}export type ChessEngineOptions = {
    defaultEngineAnalysisOn: boolean;
    engineColor?: Accessor<Color | undefined>;
    playingEngine: Accessor<boolean>;
    game: Accessor<GameModel | undefined>;
    turn: Accessor<Color>;
    applyMove: (move: NormalMove) => void;
    fen: Accessor<string>;
};

