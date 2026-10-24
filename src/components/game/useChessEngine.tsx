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
import { makeErrorToast } from "../common/Toast";
import { Color } from "chessground/types";
import { GameModel } from "../../models/GameModel";
import { getSettingValue } from "../../models/settings";
import { EvaluationExt, Path } from "../../models/pgn";
import { Box, isChildNode, walk } from "chessops/pgn";
import { makeFen, parseFen } from "chessops/fen";
import { ReviewProgress } from "./GameContext";
import anylogger from "anylogger";
const log = anylogger("usechessengine");

// UCI engines answer "bestmove (none)" (or "0000") when there is no legal move
const isNoMove = (move: string | undefined) =>
    !move || move === "(none)" || move === "0000";

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
    wrongPuzzleMove: Accessor<NormalMove | undefined>;
};

export function useChessEngine(options: ChessEngineOptions) {
    // #region Engine state
    const [engineAnalysisOn, setEngineAnalysisOn] = createSignal<boolean>(
        options.defaultEngineAnalysisOn,
    );
    const [engineName, _others] = createResource(() => getEnginePath());
    const [engine, setEngine] = createSignal<IChessEngine | undefined>(
        undefined,
    );
    const [engineInfo, setEngineInfo] = createStore<EngineInfo[]>([]);
    // searches started but not yet answered with a bestmove; a bestmove that
    // arrives while a newer search is pending belongs to a stopped search
    let pendingSearches = 0;

    const [hintMove, setHintMove] = options.hintMoveSignal;
    // const [isReviewing, setIsReviewing] = createSignal(false);
    const [reviewPositionPath, setReviewPositionPath] = createSignal<
        Path | undefined
    >(undefined);
    const [game, setGame] = options.gameSignal;

    const [annotatedGame, setAnnotatedGame] = createSignal<
        GameModel | undefined
    >(game());

    const [reviewProgress, setReviewProgress] = createSignal<
        ReviewProgress | undefined
    >(undefined);

    const isReviewing = () => !!reviewPositionPath();

    const needEngine = () => {
        return (
            engineAnalysisOn() ||
            options.playingEngine() ||
            isReviewing() ||
            options.wrongPuzzleMove()
        );
    };

    const shouldCallEngineAnalysis = createMemo(() => {
        if (
            engine() &&
            (engineAnalysisOn() || isReviewing() || options.wrongPuzzleMove())
        ) {
            return true;
        }

        return false;
    });

    const shouldCallEngineMove = createMemo(() => {
        // when playing, the engine also thinks on the player's turn: that
        // bestmove becomes the hint (see onEngineBestMove)
        const tmp =
            !!engine() && options.playingEngine() && !!options.engineColor?.();
        // check if the current position is the last one
        if (!tmp) return false;
        const node = game()?.nodeAt(options.path() || Path.root);
        if (node && node.children.length > 0) {
            return false;
        }
        return tmp;
    });

    const shouldInitEngine = () => {
        const shouldInit = needEngine() && engineName() && !engine();
        return shouldInit;
    };

    createEffect(async () => {
        if (shouldInitEngine()) {
            const engine = new UCIEngine(
                new ExecutableUCIInterface(engineName()!),
            );

            try {
                await engine.init();
            } catch (err) {
                log.error("engine failed to start", err);
                makeErrorToast(
                    err instanceof Error ? err.message : String(err),
                );
                return;
            }

            log.debug("engine initialized", engine.getOptions());
            // Add this function inside useChessEngine before onEngineBestMov
            engine.on("bestmove", onEngineBestMove);
            engine.on("info", onEngineInfo);
            engine.newGame();
            batch(() => {
                setEngine(engine);
                // setEngineAnalysisOn(true);
            });
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
            pendingSearches = 0;
        }
    };

    createEffect(() => {
        if (!needEngine()) {
            cleanup();
        }
    });

    onCleanup(() => {
        cleanup();
    });

    const incrementReviewProgress = () => {
        setReviewProgress((p) =>
            p
                ? { current: p.current + 1, total: p.total }
                : { current: 1, total: 1 },
        );
    };

    // Add this function inside useChessEngine before onEngineBestMove
    const handleReviewPosition = (bestMove: string, g: GameModel) => {
        const path = reviewPositionPath() || Path.root;
        // at checkmate/stalemate the engine answers "bestmove (none)"
        const ext = isNoMove(bestMove) ? undefined : bestMove;

        const score = engineInfo[0]?.score;
        const depth = engineInfo[0]?.depth;
        let evaluation: EvaluationExt | undefined;
        if (score) {
            evaluation =
                score.type === "cp"
                    ? { depth, pawns: score.value / 100, ext }
                    : { depth, mate: score.value, ext };
        } else {
            // some engines send no "info score" for terminal positions
            const pos = g.dataAt(path)?.pos;
            if (pos?.isCheckmate()) {
                evaluation = { depth: 0, mate: 0 };
            } else if (pos?.isEnd()) {
                evaluation = { depth: 0, pawns: 0 };
            }
        }
        let ng = annotatedGame()!;
        if (evaluation) {
            ng = ng.updateEvaluation(path, { ...evaluation });
            setAnnotatedGame(ng);
        }

        const node = g.nodeAt(path);
        if (node) {
            const next = node.children[0];
            if (next) {
                batch(() => {
                    setReviewPositionPath(next.data.path);
                    incrementReviewProgress();
                });
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
                            incrementReviewProgress();

                            return;
                        }
                    }
                }

                log.debug("No next position");
                batch(() => {
                    setGame(ng);
                    log.debug("Reviewing done", ng);
                    setReviewPositionPath(undefined);
                });
            }
        }
    };

    const onEngineBestMove = (bestMove: string, _ponder: string) => {
        pendingSearches = Math.max(0, pendingSearches - 1);
        if (pendingSearches > 0) {
            log.debug("Ignoring stale bestmove", bestMove);
            return;
        }
        const g = game();
        if (!g) {
            return;
        }
        if (
            !options.engineColor?.() ||
            options.engineColor?.() != options.turn()
        ) {
            if (isReviewing()) {
                handleReviewPosition(bestMove, g);
            }
            log.debug("Engine move", bestMove);
            setHintMove(isNoMove(bestMove) ? undefined : bestMove);
            return;
        }

        if (isNoMove(bestMove)) {
            // game is over, nothing to play
            return;
        }
        const m = { from: bestMove.slice(0, 2), to: bestMove.slice(2, 4) };
        const move: NormalMove = makeMove(m.from, m.to);
        options.applyMove(move);
    };

    const onEngineInfo = (info: EngineInfo) => {
        if (info.multipv) {
            const pos = parseFen(analyzeFen());
            if (pos.isOk && info.score) {
                if (pos.value.turn === "black") {
                    info.score.value = -info.score.value;
                }
            }
            setEngineInfo(info.multipv - 1, info);
        }
    };

    const startReview = () => {
        engine()?.stop();

        // computes the total number of positions in the game
        let total = 0;
        walk(game()!.moves, new Box(0), () => {
            total++;
            return true;
        });

        batch(() => {
            // setIsReviewing(true);
            setReviewPositionPath(Path.root);
            setAnnotatedGame(game());
            setReviewProgress({ current: 0, total });
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
        } else if (options.wrongPuzzleMove()) {
            const pos = game()!
                .dataAt(options.path() || Path.root)!
                .pos.clone();
            pos?.play(options.wrongPuzzleMove()!);
            fenStr = makeFen(pos?.toSetup(), { epd: false });
            log.debug("wrongPuzzleMove", fenStr);
        }
        return fenStr;
    });

    createEffect(() => {
        engine()?.stop();
        const fenStr = analyzeFen();
        setEngineInfo([]);
        let opts = undefined;

        const eng = engine();
        if (!eng) return;

        if (shouldCallEngineAnalysis()) {
            setHintMove(undefined);

            eng.setOption("UCI_LimitStrength", "false");
            eng.setOption("UCI_Elo", 3200);

            opts = {
                depth: getSettingValue("engine.analysis.depth", 15),
                movetime: getSettingValue("engine.analysis.movetime", 10000),
                multipv: getSettingValue("engine.analysis.multipv", 3),
                threads: getSettingValue("engine.threads", 1),
            };
        } else if (shouldCallEngineMove()) {
            setHintMove(undefined);

            // engine()!.setOption("UCI_AnalyseMode", 0);
            const enginesTurn = options.engineColor() === options.turn();
            // limit strength for the engine's own moves, not for hints
            eng.setOption("UCI_LimitStrength", enginesTurn ? "true" : "false");
            eng.setOption(
                "UCI_Elo",
                enginesTurn
                    ? getSettingValue("engine.playing.elo", 1000)
                    : 3200,
            );

            opts = {
                depth: getSettingValue("engine.playing.depth", 15),
                movetime: getSettingValue("engine.playing.movetime", 10000),
                multipv: 1,
                threads: getSettingValue("engine.threads", 1),
            };
        }
        if (opts) {
            log.debug("Analyzing", fenStr, opts);
            pendingSearches++;
            eng.analyzeFromFenOrMoves(fenStr, opts);
        }
    });

    return {
        engineInfo,
        moveHintSignal: [hintMove, setHintMove] as Signal<string | undefined>,
        // engineLevelSignal: [engineLevel, setEngineLevel] as Signal<number>,
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
