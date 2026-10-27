import { NormalMove } from "chessops";
import {
    createSignal,
    createEffect,
    on,
    batch,
    onCleanup,
    Accessor,
    Signal,
    createMemo,
    untrack,
} from "solid-js";
import { createStore } from "solid-js/store";
import {
    AnalysisOptions,
    IChessEngine,
    EngineInfo,
} from "../../engine/engineinterfaces";
import {
    activeProfile,
    analysisProfile,
    startEngine,
} from "../../engine/engineprofiles";
import { makeMove } from "../../models/chessutil";
import { makeErrorToast } from "../common/Toast";
import { Color } from "chessground/types";
import { GameModel } from "../../models/GameModel";
import { getSettingValue } from "../../models/settings";
import { EvaluationExt, Path } from "../../models/pgn";
import { makeFen, parseFen } from "chessops/fen";
import { ReviewProgress } from "./GameContext";
import { annotateMistakes } from "../../models/review";
import { nullMoveFen } from "../../models/threat";
import { scoreToEvaluation } from "../../models/whatif";
import { pickBookMove } from "../../models/books";
import { bookMoves, ENGINE_BOOK_SETTING } from "../../storage/books";
import { parseUci } from "chessops";
import { Chess } from "chessops/chess";
import {
    EngineTask,
    engineTask,
    sameTask,
    searchPlan,
} from "../../engine/enginetask";

/** Positions are remembered without the move counters */
const fenKey = (fen: string) => fen.split(" ").slice(0, 4).join(" ");
type Remembered = { evaluation: EvaluationExt; depth: number; pv: string[] };
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
    /** In a game with clocks, both clocks now: the engine plays on its time */
    clockTimes?: () => AnalysisOptions["clock"];
    /** The tutor plays the engine's moves (useTutor): this engine stays out of the game */
    tutor?: Accessor<boolean>;
};

export function useChessEngine(options: ChessEngineOptions) {
    // #region Engine state
    const [engineAnalysisOn, setEngineAnalysisOn] = createSignal<boolean>(
        options.defaultEngineAnalysisOn,
    );
    // the engine you play against is your choice; analysis, review and hints always use a
    // full-strength one (Stockfish, say), whatever engine you play against
    const profile = () =>
        options.playingEngine() ? activeProfile() : analysisProfile();
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

    const [isPlayingOn, setIsPlayingOn] = createSignal(false);
    // analysis of what the opponent would play if it were their move
    const [threatOn, setThreatOn] = createSignal(false);
    // the deepest main line seen for each analysed position, to judge moves played from it
    const [remembered, setRemembered] = createStore<Record<string, Remembered>>(
        {},
    );

    const isReviewing = () => !!reviewPositionPath();

    const needEngine = () => {
        return (
            engineAnalysisOn() ||
            options.playingEngine() ||
            isReviewing() ||
            options.wrongPuzzleMove()
        );
    };

    /** The task of the latest search: its bestmove is handled as that task says */
    let searching: EngineTask = { kind: "idle" };

    const shouldInitEngine = () => {
        const shouldInit = needEngine() && profile() && !engine();
        return shouldInit;
    };

    createEffect(async () => {
        if (shouldInitEngine()) {
            let engine: IChessEngine;
            try {
                engine = await startEngine(profile()!);
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

    // switching engine in the settings: drop the running one, the next
    // request for an engine starts the newly selected one
    createEffect(
        on(
            () => profile()?.id,
            () => cleanup(),
            { defer: true },
        ),
    );

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

        // the review follows the mainline; side variations are the user's own
        const next = g.nodeAt(path)?.children[0];
        if (next) {
            batch(() => {
                setReviewPositionPath(next.data.path);
                incrementReviewProgress();
            });
            return;
        }
        ng = annotateMistakes(ng);
        batch(() => {
            setGame(ng);
            log.debug("Reviewing done", ng);
            setReviewPositionPath(undefined);
        });
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
        const t = searching;
        const best = isNoMove(bestMove) ? undefined : bestMove;
        switch (t.kind) {
            case "idle":
                return;
            case "threat":
                // the opponent's move, not a hint for the side to move
                setHintMove(undefined);
                return;
            case "review":
                handleReviewPosition(bestMove, g);
                break;
            case "play":
                if (!t.enginesTurn) break;
                // nothing to play at the end of the game; nor when the game stopped, or the
                // position changed, while the engine was thinking
                if (!best || !isPlayingOn() || analyzeFen() !== t.fen) return;
                log.debug("Engine move", best);
                options.applyMove(makeMove(best.slice(0, 2), best.slice(2, 4)));
                return;
        }
        // analysis, refutation, review, and the player's turn in a game: a hint
        log.debug("Hint move", best);
        setHintMove(best);
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
            if (info.multipv === 1) remember(info);
        }
    };

    const remember = (info: EngineInfo) => {
        const fen = analyzeFen();
        const first = info.pv?.[0] && parseUci(info.pv[0]);
        if (!info.score || !first || threatFen() || isReviewing()) return;
        // an info that arrives late belongs to the previous position
        const setup = parseFen(fen);
        const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
        if (!pos?.isOk || !pos.value.isLegal(first)) return;
        const key = fenKey(fen);
        const depth = info.depth ?? 0;
        if ((remembered[key]?.depth ?? -1) > depth) return;
        setRemembered(key, {
            // with its depth, so an explanation can tell a deep verdict from a quick one
            evaluation: {
                ...scoreToEvaluation(info.score, info.pv![0]),
                depth,
            },
            depth,
            pv: [...info.pv!],
        });
    };

    /** The engine's view of a position analysed earlier in this session */
    const evaluationAt = (fen: string): EvaluationExt | undefined =>
        remembered[fenKey(fen)]?.evaluation;
    /** The engine's main line in a position analysed earlier */
    const lineAt = (fen: string): string[] | undefined =>
        remembered[fenKey(fen)]?.pv;

    const startReview = () => {
        if (!profile() || profile()!.singleNode) {
            makeErrorToast(
                "Reviewing needs a full-strength engine such as Stockfish: add one in Settings.",
            );
            return;
        }
        engine()?.stop();

        const total = game()!.mainline.length + 1;

        batch(() => {
            // setIsReviewing(true);
            setReviewPositionPath(Path.root);
            setAnnotatedGame(game());
            setReviewProgress({ current: 0, total });
        });
    };

    /** The searched position in threat mode: the current one with the other side to move */
    const threatFen = createMemo(() =>
        threatOn() &&
        engineAnalysisOn() &&
        !isReviewing() &&
        !options.wrongPuzzleMove() &&
        !options.playingEngine()
            ? nullMoveFen(options.fen())
            : undefined,
    );

    const analyzeFen = createMemo(() => {
        let fenStr = threatFen() ?? options.fen();
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

    /** What the engine does now (engine/enginetask.ts); a new task restarts the search */
    const task = createMemo<EngineTask>(
        () =>
            engineTask({
                hasEngine: !!engine(),
                analysisOn: engineAnalysisOn(),
                reviewing: isReviewing(),
                refuting: !!options.wrongPuzzleMove(),
                threat: !!threatFen(),
                playing: options.playingEngine() && isPlayingOn(),
                engineColor: options.engineColor(),
                tutor: !!options.tutor?.(),
                atEnd: !game()?.nodeAt(options.path() || Path.root)?.children
                    .length,
                turn: options.turn(),
                fen: analyzeFen(),
            }),
        { kind: "idle" },
        { equals: sameTask },
    );
    /** The engine's lines are about the position (not a game move or nothing) */
    const engineCallable = createMemo(() =>
        ["review", "refutation", "threat", "analysis"].includes(task().kind),
    );

    // every new task stops the search and starts its own (the settings it reads are tracked:
    // changing the number of lines restarts the analysis)
    createEffect(() => {
        const t = task();
        const eng = engine();
        eng?.stop();
        setEngineInfo([]);
        searching = t;
        if (!eng || t.kind === "idle") return;
        const plan = searchPlan(t, profile(), getSettingValue);
        if (!plan) return;
        setHintMove(undefined);
        if (plan.strength) {
            eng.setOption(
                "UCI_LimitStrength",
                plan.strength.limit ? "true" : "false",
            );
            eng.setOption("UCI_Elo", plan.strength.elo);
        }
        const search = (opts: typeof plan.options) => {
            log.debug("Analyzing", t.fen, opts);
            pendingSearches++;
            eng.analyzeFromFenOrMoves(t.fen, opts);
        };
        if (t.kind !== "play" || !t.enginesTurn) {
            search(plan.options);
            return;
        }
        // the engine's own move: on its clock (untracked: the clocks tick, the search must
        // not restart with them)
        const opts = {
            ...plan.options,
            clock: untrack(() => options.clockTimes?.()),
        };
        // while the position is in the chosen book, the engine plays a book move
        const book = getSettingValue(ENGINE_BOOK_SETTING, "");
        if (!book) {
            search(opts);
            return;
        }
        bookMoves(book, t.fen)
            .then((moves) => pickBookMove(moves))
            .catch((err) => {
                log.warn("book lookup failed", err);
                return undefined;
            })
            .then((uci) => {
                // the task changed, or the engine was replaced, meanwhile
                if (searching !== t || engine() !== eng) return;
                const move = uci && parseUci(uci);
                if (move && "from" in move) {
                    log.debug("Book move", uci);
                    options.applyMove(move);
                } else {
                    search(opts);
                }
            });
    });

    return {
        engineInfo,
        moveHintSignal: [hintMove, setHintMove] as Signal<string | undefined>,
        engineCallable,
        engineAnalysisOnSignal: [
            engineAnalysisOn,
            setEngineAnalysisOn,
        ] as Signal<boolean>,
        isReviewing,
        startReview,
        reviewProgress,
        isPlayingOnSignal: [isPlayingOn, setIsPlayingOn] as Signal<boolean>,
        threatOnSignal: [threatOn, setThreatOn] as Signal<boolean>,
        threatFen,
        analyzedFen: analyzeFen,
        evaluationAt,
        lineAt,
    };
}
