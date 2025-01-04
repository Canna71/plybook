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
import { set } from "es-toolkit/compat";

export function useChessEngine(options: ChessEngineOptions) {
    // #region Engine state
    const [engineOn, setEngineOn] = createSignal<boolean>(options.defaultEngineOn);
    const [engineFolder, _others] = createResource(() => getEnginePath());
    const [engine, setEngine] = createSignal<IChessEngine | undefined>(
        undefined
    );
    const [engineInfo, setEngineInfo] = createStore<EngineInfo[]>([]);

    const engineCallable = () => engine() && engineOn() && engineFolder();

    const shouldInitEngine = () => {
        const shouldInit = (engineOn() || options.engineColor?.()) && engineFolder() && (!engine() || !engineOn());
        console.log("shouldInitEngine flags:", {
            engineOn: engineOn(),
            engineColor: options.engineColor?.(),
            engineFolder: engineFolder(),
            engineExists: !!engine(),
            engineNotOn: !engineOn()
        });
        console.log("shouldInitEngine result:", shouldInit);
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
                setEngineOn(true);
            });
        } else {
        }
    });

    // cleanup engine when engineOn is false
    
    const cleanup = () => {
        const eng = engine();
        if (eng) {
            eng.quit();
            eng.off("bestmove", onEngineBestMove);
            setEngine(undefined);
        }
    }
    
    createEffect(() => {
        if (!engineOn()) {
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
            // console.log("Analyzing position", fenStr);
            engine()!.analyzeFromFenOrMoves(fenStr, { depth: 15, multipv: 3 });
        }
    });

    return {
        engineInfo,
        engineCallable,
        engineOnSignal: [engineOn, setEngineOn] as Signal<boolean>,
    };
}export type ChessEngineOptions = {
    defaultEngineOn: boolean;
    engineColor?: Accessor<Color | undefined>;
    game: Accessor<GameModel | undefined>;
    turn: Accessor<Color>;
    applyMove: (move: NormalMove) => void;
    fen: Accessor<string>;
};

