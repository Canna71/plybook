import { NormalMove } from "chessops";
import {
    createSignal,
    createResource,
    createEffect,
    batch,
    onCleanup,
    Accessor,
    Signal,
    createMemo,
} from "solid-js";
import { createStore } from "solid-js/store";
import { IChessEngine, EngineInfo } from "../../engine/engineinterfaces";
import { ExecutableUCIInterface } from "../../engine/executableuci";
import { UCIEngine } from "../../engine/uciengine";
import { getEnginePath } from "../../storage/fs";
import { makeMove } from "../common/utils";
import { Color } from "chessground/types";
import { GameModel } from "../../models/GameModel";
import { getSettingValue, setSettingValue } from "../../models/settings";
import { create } from "@tauri-apps/plugin-fs";
import { isPlyData, Path } from "../../models/pgn";

export type ChessEngineOptions = {
    defaultEngineAnalysisOn: boolean;
    engineColor: Accessor<Color | undefined>;
    playingEngine: Accessor<boolean>;
    game: Accessor<GameModel | undefined>;
    path: Accessor<Path | undefined>;
    turn: Accessor<Color>;
    applyMove: (move: NormalMove) => void;
    fen: Accessor<string>;
};

export function useChessEngine(options: ChessEngineOptions) {
    // #region Engine state
    const [engineAnalysisOn, setEngineAnalysisOn] = createSignal<boolean>(
        options.defaultEngineAnalysisOn,
    );
    const [engineFolder, _others] = createResource(() => getEnginePath());
    const [engine, setEngine] = createSignal<IChessEngine | undefined>(
        undefined,
    );
    const [engineInfo, setEngineInfo] = createStore<EngineInfo[]>([]);

    const [engineLevel, setEngineLevel] =
        //createSignal<number>(1000);
        [
            () => getSettingValue("engine.playing.elo", 1000),
            (v: number) => {
                setSettingValue("engine.playing.elo", v);
            },
        ];

    const shouldCallEngineAnalysis = createMemo(() => {
        if(engine() && engineAnalysisOn()) {
            return true;
        }
        if(options.playingEngine() && options.engineColor?.() && options.engineColor?.() !== options.turn()) {
            return true;
        }
        return false;
    });

    const shouldCallEngineMove = createMemo(() => {
        let tmp = engine() &&
        options.playingEngine() &&
        options.engineColor?.() == options.turn();
        // TODO: check if the current position is the last one
        if(!tmp) return false;
        const node = options.game()?.nodeAt(options.path() || Path.root);
        console.log("Node", node);
        if(node && node.children.length > 0) {
            console.log("Node has children", node.children);
            return false;
        }
        console.log("Should call engine move", tmp);
        return tmp;
    })


    const shouldInitEngine = () => {
        const shouldInit =
            (engineAnalysisOn() || options.playingEngine?.()) &&
            engineFolder() &&
            !engine();
        return shouldInit;
    };

    createEffect(async () => {
        if (shouldInitEngine()) {
            const engine = new UCIEngine(
                new ExecutableUCIInterface(engineFolder()!),
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

    createEffect(() => {
        if(engine() && !options.engineColor()) {
            engine()!.stop();
        }
    });

    const cleanup = () => {
        const eng = engine();
        if (eng) {
            eng.quit();
            eng.off("bestmove", onEngineBestMove);
            setEngine(undefined);
        }
    };

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
        if (
            !options.engineColor?.() ||
            options.engineColor?.() != options.turn()
        ) {
            return;
        }
        console.log("Engine best move", options.engineColor?.(), options.turn());
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
        if (shouldCallEngineAnalysis()) {
            const fenStr = options.fen();
            setEngineInfo([]);
            // engine()!.setOption("UCI_AnalyseMode", 1);
            engine()!.setOption("UCI_LimitStrength", "false");
            engine()!.setOption("UCI_Elo", 3200);
            // engine()!.setOption("MultiPV", 3);

            const analysisOptions = {
                depth: getSettingValue("engine.analysis.depth", 15),
                multipv: getSettingValue("engine.analysis.multipv", 3),
            };
            console.log("Analysis options", analysisOptions);

            engine()!.analyzeFromFenOrMoves(fenStr, analysisOptions);
        } else if (shouldCallEngineMove()) {
            // engine()!.setOption("UCI_AnalyseMode", 0);
            engine()!.setOption("UCI_LimitStrength", "true");
            engine()!.setOption("UCI_Elo", engineLevel());
            const fenStr = options.fen();

            const playingOptions = {
                depth: getSettingValue("engine.playing.depth", 15),
                multipv: 1,
            };

            engine()!.analyzeFromFenOrMoves(fenStr, playingOptions);
        }
    });

    return {
        engineInfo,

        engineLevelSignal: [engineLevel, setEngineLevel] as Signal<number>,
        engineCallable: shouldCallEngineAnalysis,
        engineAnalysisOnSignal: [
            engineAnalysisOn,
            setEngineAnalysisOn,
        ] as Signal<boolean>,
    };
}
