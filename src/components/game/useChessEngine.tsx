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
import { EvaluationExt, Path } from "../../models/pgn";
import { isChildNode } from "chessops/pgn";
import { parseFen } from "chessops/fen";

export type ChessEngineOptions = {
    defaultEngineAnalysisOn: boolean;
    engineColor: Accessor<Color | undefined>;
    playingEngine: Accessor<boolean>;
    gameSignal: Signal<GameModel | undefined>;
    path: Accessor<Path | undefined>;
    turn: Accessor<Color>;
    applyMove: (move: NormalMove) => void;
    fen: Accessor<string>;
    hintMoveSignal: Signal<string | undefined>;
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
    const [hintMove, setHintMove] = options.hintMoveSignal;
    // const [isReviewing, setIsReviewing] = createSignal(false);
    const [reviewPositionPath, setReviewPositionPath] = createSignal<
        Path | undefined
    >(undefined);
    const [game, setGame] = options.gameSignal;

    const [annotatedGame, setAnnotatedGame] = createSignal<
        GameModel | undefined
    >(game());

    const [engineLevel, setEngineLevel] =
        //createSignal<number>(1000);
        [
            () => getSettingValue("engine.playing.elo", 1000),
            (v: number) => {
                setSettingValue("engine.playing.elo", v);
            },
        ];

    const isReviewing = () => !!reviewPositionPath();

    const reviewProgress = createMemo(() => {
        if (isReviewing()) {
            const path = reviewPositionPath() || Path.root;
            const total = game()?.mainline.length || 0;
            // TODO: handle progress with variations
            return {
                total: total + 1,
                current: path.size(),
            };
        } else return undefined;
    });

    const shouldCallEngineAnalysis = createMemo(() => {
        if (engine() && (engineAnalysisOn() || isReviewing())) {
            return true;
        }
        // if(options.playingEngine() && options.engineColor?.() && options.engineColor?.() !== options.turn()) {
        //     return true;
        // }
        return false;
    });

    const shouldCallEngineMove = createMemo(() => {
        let tmp =
            engine() &&
            options.playingEngine() &&
            options.engineColor?.() == options.turn();
        tmp ||= !!options.engineColor?.();
        // check if the current position is the last one
        if (!tmp) return false;
        const node = game()?.nodeAt(options.path() || Path.root);
        if (node && node.children.length > 0) {
            return false;
        }
        return tmp;
    });

    const shouldInitEngine = () => {
        const shouldInit =
            (engineAnalysisOn() ||
                options.playingEngine?.() ||
                isReviewing()) &&
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

            console.log("engine initialized", engine.getOptions());
            // Add this function inside useChessEngine before onEngineBestMov
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
        if (engine() && !options.engineColor()) {
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
        if (
            !engineAnalysisOn() &&
            !options.playingEngine?.() &&
            !isReviewing()
        ) {
            cleanup();
        }
    });

    onCleanup(() => {
        cleanup();
    });

    // Add this function inside useChessEngine before onEngineBestMove
    const handleReviewPosition = (bestMove: string, g: GameModel) => {
        const path = reviewPositionPath() || Path.root;
        let ext = bestMove;

        let score = engineInfo[0]?.score;
        const depth = engineInfo[0]?.depth;
        const evaluation: EvaluationExt =
            score!.type === "cp"
                ? {
                      depth: depth,
                      pawns: score!.value / 100,
                      ext: ext,
                  }
                : {
                      depth: depth,
                      mate: score!.value,
                      ext: ext,
                  };
        const ng = annotatedGame()!.updateEvaluation(path, {
            ...evaluation,
        });
        setAnnotatedGame(ng);

        const node = g.nodeAt(path);
        if (node) {
            const next = node.children[0];
            if (next) {
                setReviewPositionPath(next.data.path);
            } else {
                let cn = node;
                // try to find an uneexplored anchestor
                let parent = g.nodeAt(path.previous());
                while (parent && isChildNode(parent) && isChildNode(cn)) {
                    if (
                        parent?.children.indexOf(cn) ===
                        parent?.children.length - 1
                    ) {
                        cn = parent;
                        parent = g.nodeAt(parent.data.path.previous());
                    } else {
                        cn = parent.children[parent.children.indexOf(cn) + 1];
                        if (isChildNode(cn)) {
                            setReviewPositionPath(cn.data.path);
                            return;
                        }
                    }
                }

                console.log("No next position");
                batch(() => {
                    setGame(ng);
                    console.log("Reviewing done", ng);
                    setReviewPositionPath(undefined);
                });
            }
        }
    };

    const onEngineBestMove = (bestMove: string, _ponder: string) => {
        const g = game();
        if (!g) {
            return;
        }
        const m = { from: bestMove.slice(0, 2), to: bestMove.slice(2, 4) };
        const move: NormalMove = makeMove(m.from, m.to);
        if (
            !options.engineColor?.() ||
            options.engineColor?.() != options.turn()
        ) {
            if (isReviewing()) {
                handleReviewPosition(bestMove, g);
            }
            setHintMove(bestMove);
            return;
        }

        options.applyMove(move);
    };

    const onEngineInfo = (info: EngineInfo) => {
        if (info.multipv) {
            const pos = parseFen(analyzeFen());
            if (pos.isOk) {
                if (pos.value.turn === "black") {
                    info.score!.value = -info.score!.value;
                }
            }
            setEngineInfo(info.multipv - 1, info);
        }
    };

    const startReview = () => {
        engine()?.stop();
        batch(() => {
            // setIsReviewing(true);
            setReviewPositionPath(Path.root);
            setAnnotatedGame(game());
        });
    };

    // // this should triger when stating a game review/evaluation process
    // createEffect(() => {
    //     const reviewing = isReviewing();
    //     // const
    //     if (reviewing) {
    //         // engine()?.stop();
    //         setAnnotatedGame(game());
    //         setReviewPositionPath(Path.root);
    //     }
    // });

    const analyzeFen = createMemo(() => {
        let fenStr = options.fen();
        if (isReviewing()) {
            fenStr = game()!.dataAt(reviewPositionPath() || Path.root)!.fen;
            // console.log("Reviewing: ", fenStr);
        }
        return fenStr;
    });

    // TODO: avoid conflicts with review mode
    createEffect(() => {
        engine()?.stop();
        let fenStr = analyzeFen();
        setEngineInfo([]);
        let opts = undefined;

        if (shouldCallEngineAnalysis()) {
            setHintMove(undefined);

            engine()!.setOption("UCI_LimitStrength", "false");
            engine()!.setOption("UCI_Elo", 3200);

            opts = {
                depth: getSettingValue("engine.analysis.depth", 15),
                multipv: getSettingValue("engine.analysis.multipv", 3),
            };
        } else if (shouldCallEngineMove()) {
            setHintMove(undefined);

            // engine()!.setOption("UCI_AnalyseMode", 0);
            engine()!.setOption("UCI_LimitStrength", "true");
            engine()!.setOption("UCI_Elo", engineLevel());

            opts = {
                depth: getSettingValue("engine.playing.depth", 15),
                multipv: 1,
            };
        }
        if (opts) {
            engine()!.analyzeFromFenOrMoves(fenStr, opts);
        }
    });

    return {
        engineInfo,
        moveHintSignal: [hintMove, setHintMove] as Signal<string | undefined>,
        engineLevelSignal: [engineLevel, setEngineLevel] as Signal<number>,
        engineCallable: shouldCallEngineAnalysis,
        engineAnalysisOnSignal: [
            engineAnalysisOn,
            setEngineAnalysisOn,
        ] as Signal<boolean>,
        isReviewing,
        startReview,
        reviewProgress,
    };
}
