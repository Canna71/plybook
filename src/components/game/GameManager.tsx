import {
    Accessor,
    batch,
    Component,
    createEffect,
    createMemo,
    createSignal,
    onCleanup,
    onMount,
    Show,
    untrack,
} from "solid-js";
import { makeGameInternal, Path } from "../../models/pgn";
import { ShortcutsHelp, useShortcuts } from "./useShortcuts";
import { GameModel } from "../../models/GameModel";
import { otherColor } from "../../models/chessutil";
import { useSplitter } from "../common/useSplitter";
import { initFromGameModel } from "./gameInit";
import { useFen, usePosition } from "./gamePosition";
import { Color } from "chessground/types";
import { INITIAL_FEN } from "chessops/fen";
import {
    GameContext,
    GameContextType,
    HintType,
    TooltipContext,
} from "./GameContext";
import { VDivider } from "../common/VDivider";
import { NormalMove, parseUci } from "chessops";
import "./GameManager.scss";
import { useHumanMoves } from "./useHumanMoves";
import { Tooltip } from "../common/Tooltip";
import { ViewMode } from "./PgnEditBar";
import { useChessEngine } from "./useChessEngine";
import { playSoundForMove } from "./playSoundForMove";
import { useTooltip } from "./useTooltip";
import MarkdownEditor from "../common/MarkdownEditor";
import { makePgn, parsePgn } from "chessops/pgn";
import PageNavigator from "./MultiPage";
import { getSettingValue, setSettingValue } from "../../models/settings";
import { setSectionOpen } from "./PanelSection";
import AnalysisPanel from "./AnalysisPanel";
import TrainerPanel from "./TrainerPanel";
import anylogger from "anylogger";
import { showAlert } from "../common/Alert";
import { gameEnd, timeoutEnd } from "../../models/play";
import { pgnTimeControl } from "../../models/clock";
import { GameClock, useGameClock } from "./useGameClock";
import { TUTOR_SETTING, useTutor } from "./useTutor";
import TutorPanel from "./TutorPanel";
import { usePuzzle } from "./usePuzzle";
import { boardConfig } from "./boardConfig";
import { useMoveInput } from "./useMoveInput";
import { gameApi, GameManagerApi } from "./gameApi";
import BoardArea from "./BoardArea";

export type { GameManagerApi } from "./gameApi";

/** The board / divider / panel columns, as the divider leaves them */
const WORKSPACE_COLUMNS = "layout.workspace.columns";
const log = anylogger("gamemanager");

export type GameManagerOptions = {
    initalPgn?: Accessor<string | undefined>;
    setPgn?: (pgn: string) => void;
    playingEngine?: boolean;
    defaultEngineAnalysisOn?: boolean;
    initialFen?: string;
    /** In a file of several games, the one to show first (from 0) */
    initialGameIndex?: number;
    onPuzzleFinished?: (
        solved: boolean,
        hintUsed: number,
        retries: number,
    ) => void;
    /** Puzzles: the training frame's title, a note (a rating change) and its actions */
    puzzleTitle?: Accessor<string>;
    puzzleNote?: Accessor<string | undefined>;
    onNextPuzzle?: () => void;
    onAnalyzePuzzle?: () => void;
    onGameFinished?: () => void;
    editable?: Accessor<boolean>;
    /** Board above the moves, for a side panel (the PDF reader's notes) */
    compact?: boolean;
    /** Hands the parent what it may do to the game being edited */
    onReady?: (api: GameManagerApi) => void;
};

const GameManager: Component<GameManagerOptions> = ({
    initalPgn: initialPgn,
    setPgn,
    playingEngine,
    initialFen,
    initialGameIndex,
    onPuzzleFinished,
    editable,
    defaultEngineAnalysisOn = false,
    onGameFinished,
    compact,
    onReady,
    puzzleTitle,
    puzzleNote,
    onNextPuzzle,
    onAnalyzePuzzle,
}) => {
    // #region Game State
    const [currentPath, setCurrentPath] = createSignal<Path | undefined>(
        new Path(""),
    );
    const [game, setGame] = createSignal<GameModel | undefined>(undefined);

    const [highlightedSquares, setHighlightedSquares] = createSignal<string[]>(
        [],
    );
    const [highlightedMoves, setHighlightedMoves] = createSignal<string[]>([]);
    const [startingPosition, setStartingPosition] = createSignal<
        string | undefined
    >(initialFen || INITIAL_FEN);

    const [editPgn, setEditPgn] = createSignal<string | undefined>(undefined);
    const [fullPgn, setFullPgn] = createSignal<string | undefined>(
        initialPgn?.(),
    );

    const [description, setDescription] = createSignal<string>("");
    const [isEditingDescription, setIsEditingDescription] = createSignal(false);

    const [viewMode, setViewMode] = createSignal<ViewMode>(ViewMode.MOVES);
    const [gameIndex, setGameIndex] = createSignal(initialGameIndex ?? 0);

    const [engineColor, setEngineColor] = createSignal<Color | undefined>(
        undefined,
    );
    /** Playing the tutor instead of the plain engine (setting tutor.on, Play screen) */
    const tutorOn = () =>
        !!playingEngine && !!getSettingValue(TUTOR_SETTING, false);

    const [hintType, setHintType] = createSignal(HintType.None);
    const [hintMove, setHintMove] = createSignal<string | undefined>(undefined);

    // #endregion
    const isEditable = () => {
        return !!editable?.();
    };

    // dragging the divider sizes the panel; the board takes the rest
    const divider = useSplitter((layout) => {
        setSettingValue(WORKSPACE_COLUMNS, layout);
    });

    // #region Computed Properties

    const position = usePosition(game, currentPath);

    const fen = useFen(game, currentPath);

    const turn = createMemo(() => position().turn as Color);

    // turned round by the "flip" shortcut where the PGN can't record it (playing, puzzles)
    const [flipped, setFlipped] = createSignal(false);
    const baseOrientation = (): Color => {
        const engCol = engineColor?.();
        if (playingEngine) {
            return otherColor(engCol);
        }
        const g = game();
        if (!g) {
            return "white";
        }
        const orientationHeader = g.headers.get("Orientation");
        if (orientationHeader) {
            return orientationHeader === "white" ? "white" : "black";
        }
        const sp = g.initial.pos.turn;
        return sp;
    };
    const orientation = createMemo(() =>
        flipped() ? otherColor(baseOrientation()) : baseOrientation(),
    );

    const isPuzzleMode = createMemo(() => {
        return typeof onPuzzleFinished === "function";
    });

    const hasMoves = createMemo(() => (game()?.mainline?.length ?? 0) > 0);

    const memoPath = createMemo(() => currentPath(), undefined, {
        equals: (a, b) => {
            return !!(a && b && a.equals(b));
        },
    });

    const memoDataAtPath = createMemo(
        () => game()?.dataAt(currentPath() || new Path("")),
        undefined,
        {
            equals: (a, b) => {
                return !!(a && b && a.fen === b.fen);
            },
        },
    );

    // #region Game Manipulation

    const applyMove = (move: NormalMove) => {
        log.debug("Applying move", move);
        const g = game();
        if (!g) {
            return;
        }
        const path = currentPath() || Path.root;
        log.debug("Current move", move);
        const isLegal = g.isLegal(path, move);
        if (!isLegal) {
            log.warn("Illegal move, considering it a late hint", move);
            return;
        }

        const [appliedGame, newPath] = g.applyMoves(path, [move]);
        let newGameModel = appliedGame;
        // with clocks: the mover's clock stops, its time left goes on the move
        const left =
            playingEngine && isPlayingOn() ? gameClock?.press() : undefined;
        if (left !== undefined)
            newGameModel = newGameModel.updateClock(newPath, left);
        // only games against the engine end with a result and an alert
        const end =
            playingEngine && isPlayingOn()
                ? gameEnd(newGameModel.getPosition(newPath), engineColor?.())
                : undefined;
        if (end) {
            newGameModel = newGameModel.updateHeaders(
                new Map([["Result", end.result]]),
            );
            setTimeout(() => showAlert(end), 500);
        }
        batch(() => {
            setHintType(HintType.None);
            if (end) setIsPlayingOn(false);
            setCurrentPath(newPath);
            setGame(newGameModel);
        });
        // after the batch, so listeners see the final move and result
        if (end) onGameFinished?.();
    };

    // #endregion

    // #region Effects

    createEffect(() => {
        setFullPgn(initialPgn?.());
    });

    // this is a  effect triggered when the game changes
    createEffect(() => {
        const gIdx = untrack(gameIndex);
        const fPgn = untrack(fullPgn);

        const g = game();
        if (!g) return;
        let path = currentPath();
        let data = path && g.dataAt(path);

        const games = parsePgn(fPgn || "");
        games[gIdx] = g.game!;
        const newPgn = games.map((g) => makePgn(g)).join("\n");
        batch(() => {
            if (newPgn && newPgn !== fPgn) {
                setFullPgn?.(newPgn);
            }
            while (!data && (path?.size() || 0) > 0) {
                path = path?.previous();

                data = path && g.dataAt(path);
            }
            setCurrentPath(path);
        });
    });

    const puzzle = usePuzzle({
        isPuzzleMode,
        game,
        path: memoPath,
        setPath: setCurrentPath,
        position,
        turn,
        orientation,
        applyMove,
        hintType,
        setHintType,
        setHintMove,
        puzzle: () => initialPgn?.(),
        onFinished: onPuzzleFinished,
    });

    // play sound when path changes
    createEffect(() => {
        const path = memoPath();

        if ((path?.size() || 0) === 0) return;
        if (path) {
            const ply = memoDataAtPath();
            setTimeout(() => {
                playSoundForMove(ply, path, game()!);
            }, 1);
        }
    });

    // page changes when game index or full pgn changes
    createEffect(() => {
        const gIdx = gameIndex();
        const fPgn = fullPgn();
        const games = parsePgn(fPgn || "");
        if (gIdx >= 0 && gIdx < games.length) {
            const gameModel = makeGameInternal(games[gIdx]);
            initFromGameModel(gameContext, gameModel);
        } else if (initialFen) {
            const gameModel = makeGameInternal(
                parsePgn("[]")[0],
            ).withStartingPosition(initialFen);
            initFromGameModel(gameContext, gameModel);
        }
    });

    // updates external pgn when internal fullPgn changes
    createEffect(() => {
        const pgnString = fullPgn();
        if (pgnString) {
            setPgn?.(pgnString);
        }
    });

    // #endregion

    // #region Engine

    const {
        engineInfo,
        engineCallable,
        engineAnalysisOnSignal,
        isReviewing,
        startReview,
        reviewProgress,
        isPlayingOnSignal: [isPlayingOn, setIsPlayingOn],
        threatOnSignal,
        threatFen,
        analyzedFen,
        evaluationAt,
        lineAt,
    } = useChessEngine({
        defaultEngineAnalysisOn,
        engineColor,
        gameSignal: [game, setGame],
        path: currentPath,
        turn,
        applyMove,
        fen,
        playingEngine: () => !!playingEngine,
        hintMoveSignal: [hintMove, setHintMove],
        wrongPuzzleMove: puzzle.wrongMove,
        clockTimes: () => gameClock?.times(),
        tutor: tutorOn,
    });

    // the tutor plays the engine's moves and coaches (Play screen, tutor on)
    const tutor = playingEngine
        ? useTutor({
              on: tutorOn,
              playing: isPlayingOn,
              engineColor: () => engineColor?.(),
              game,
              setGame,
              path: currentPath,
              setPath: setCurrentPath,
              fen,
              applyMove,
          })
        : undefined;

    // clocks for games against the engine (made here: they end the game on time)
    const gameClock: GameClock | undefined = playingEngine
        ? useGameClock({
              playing: isPlayingOn,
              turn,
              onStart: (tc) => {
                  const g = game();
                  if (g)
                      setGame(
                          g.updateHeaders(
                              new Map([["TimeControl", pgnTimeControl(tc)]]),
                          ),
                      );
              },
              onFlag: (color) => {
                  const g = game();
                  if (!g || !isPlayingOn()) return;
                  const end = timeoutEnd(
                      g.getPosition(currentPath() ?? Path.root),
                      color,
                      engineColor?.(),
                  );
                  batch(() => {
                      setIsPlayingOn(false);
                      setGame(
                          g.updateHeaders(new Map([["Result", end.result]])),
                      );
                  });
                  setTimeout(() => showAlert(end), 100);
                  onGameFinished?.();
              },
          })
        : undefined;

    // what players at the Maia net's level would play, during plain analysis only
    const { humanMoves, humanProfileName } = useHumanMoves(() =>
        engineCallable() &&
        !playingEngine &&
        !isReviewing() &&
        !isPuzzleMode() &&
        !threatFen()
            ? fen()
            : undefined,
    );

    const gameContext = {
        fullPgnSignal: [fullPgn, setFullPgn],
        gameSignal: [game, setGame],
        currentPathSignal: [currentPath, setCurrentPath],
        startingPositionSignal: [startingPosition, setStartingPosition],
        viewModeSignal: [viewMode, setViewMode],
        editPgnSignal: [editPgn, setEditPgn],
        engineAnalysisOnSignal,
        descriptionSignal: [description, setDescription],
        isEditingDescriptionSignal: [
            isEditingDescription,
            setIsEditingDescription,
        ],
        gameIndexSignal: [gameIndex, setGameIndex],
        playingEngine: () => !!playingEngine,
        orientation: orientation,
        highlightedSquaresSignal: [
            createMemo(highlightedSquares),
            setHighlightedSquares,
        ],
        highlightedMovesSignal: [
            createMemo(highlightedMoves),
            setHighlightedMoves,
        ],
        editable: isEditable,
        isPuzzleMode: isPuzzleMode,
        engineColorSignal: [engineColor, setEngineColor],
        isPlayingOnSignal: [isPlayingOn, setIsPlayingOn],
        hintMoveSignal: [hintMove, setHintMove],
        hintTypeSignal: [hintType, setHintType],
        isReviewing,
        startReview,
        reviewProgress,
        threatOnSignal,
        threatFen,
        analyzedFen,
        evaluationAt,
        lineAt,
        onGameFinished,
    } as GameContextType;
    // #endregion

    onReady?.(gameApi(game, setGame, currentPath, setCurrentPath));

    // #region Board

    const moveInput = useMoveInput({
        game,
        setGame,
        position,
        checkMove: puzzle.checkMove,
        applyMove,
    });

    const config = boardConfig({
        game,
        path: currentPath,
        position,
        orientation,
        highlightedSquares,
        highlightedMoves,
        playingEngine: !!playingEngine,
        engineColor,
        isPuzzleMode,
        wrongPuzzleMove: puzzle.wrongMove,
        hintMove,
        hintType,
        threatFen,
        engineInfo,
        onMove: moveInput.onMove,
        onDrawChange: (shapes) =>
            setGame(game()?.updateShapes(currentPath()!, shapes)),
    });

    // the eval bar: the engine's evaluation of the position shown, else one saved in the
    // PGN ([%eval] from a review); not while playing the engine or solving a puzzle
    const shownEvaluation = () => {
        const f = fen();
        if (threatFen()) return undefined;
        return (
            evaluationAt(f) ??
            game()?.dataAt(currentPath() ?? Path.root)?.evaluation
        );
    };
    const showEvalBar = () =>
        !compact &&
        !playingEngine &&
        !isPuzzleMode() &&
        (engineAnalysisOnSignal[0]() || !!shownEvaluation());
    // #endregion

    // a review shows its progress in its section: open it
    createEffect(() => {
        if (isReviewing()) untrack(() => setSectionOpen("review", true));
    });

    // #region keyboard

    let container: HTMLDivElement | undefined;
    // a side panel (the PDF reader's notes) takes keys only after a click inside it, so the
    // page around it keeps its arrows
    const [active, setActive] = createSignal(!compact);
    if (compact) {
        const onPointer = (e: PointerEvent) =>
            setActive(!!container?.contains(e.target as Node));
        onMount(() => {
            document.addEventListener("pointerdown", onPointer, true);
            onCleanup(() =>
                document.removeEventListener("pointerdown", onPointer, true),
            );
        });
    }
    const showShortcuts = createSignal(false);
    // pen mode (U.2): a plain click or drag draws on the board; not while a game is played
    const [penOn, setPenOn] = createSignal(false);
    const canDraw = () => !(playingEngine && isPlayingOn());
    useShortcuts({
        game,
        currentPath,
        setCurrentPath,
        // as the Flip Board button when editing (saved in the PGN); else the view only
        flip: () => {
            const g = game();
            if (g && !playingEngine && isEditable() && !isPuzzleMode())
                setGame(
                    g.updateHeaders(
                        new Map([["Orientation", otherColor(orientation())]]),
                    ),
                );
            else setFlipped((f) => !f);
        },
        engineAnalysisOn: engineAnalysisOnSignal,
        threatOn: threatOnSignal,
        playBestMove: () => {
            // only lines for the position shown, not one analysed a moment ago
            if (threatFen() || analyzedFen() !== fen()) return;
            const uci = engineInfo[0]?.pv?.[0];
            const move = uci && parseUci(uci);
            if (move && "from" in move) applyMove(move);
        },
        canNavigate: () => !isPuzzleMode() && !(playingEngine && isPlayingOn()),
        togglePen: () => canDraw() && setPenOn((on) => !on),
        isActive: active,
        help: showShortcuts,
    });
    // #endregion

    const { reference, ply, showTooltip } = useTooltip();

    return (
        <>
            <GameContext.Provider value={gameContext}>
                <TooltipContext.Provider value={{ showTooltip }}>
                    <div
                        ref={container}
                        class="pgnviewer-container"
                        classList={{ compact }}
                        style={
                            compact
                                ? undefined
                                : {
                                      // the board takes what the panel leaves
                                      "grid-template-columns": getSettingValue(
                                          WORKSPACE_COLUMNS,
                                          "1fr 5px 440px",
                                      ),
                                  }
                        }
                    >
                        <BoardArea
                            config={config}
                            turn={turn}
                            fit={!compact}
                            clock={gameClock}
                            showEvalBar={showEvalBar}
                            evaluation={shownEvaluation}
                            promotionCell={() => moveInput.promotion()?.cell}
                            onPromotionSelected={moveInput.onPromotionSelected}
                            pen={
                                canDraw()
                                    ? { on: penOn, setOn: setPenOn }
                                    : undefined
                            }
                        />
                        <Show when={!compact}>
                            <VDivider ref={divider!} />
                        </Show>
                        <AnalysisPanel
                            trainer={
                                <>
                                    <Show when={isPuzzleMode()}>
                                        <TrainerPanel
                                            title={puzzleTitle?.() ?? "Puzzle"}
                                            side={orientation}
                                            status={puzzle.status}
                                            note={puzzleNote}
                                            onHintPiece={() =>
                                                setHintType(HintType.Piece)
                                            }
                                            onHintMove={() =>
                                                setHintType(HintType.Move)
                                            }
                                            onRetry={puzzle.reset}
                                            onNext={onNextPuzzle}
                                            nextLabel={
                                                puzzle.solved()
                                                    ? "Next puzzle"
                                                    : "Skip"
                                            }
                                            onAnalyze={onAnalyzePuzzle}
                                        />
                                    </Show>
                                    <Show when={tutor && tutorOn()}>
                                        <TutorPanel tutor={tutor!} />
                                    </Show>
                                </>
                            }
                            engineInfo={engineInfo}
                            engineCallable={engineCallable}
                            humanMoves={humanMoves}
                            humanProfileName={humanProfileName}
                            fen={fen}
                            hasMoves={hasMoves}
                            isEditable={isEditable}
                        />

                        <div class="game-description">
                            <MarkdownEditor
                                isEditingSignal={[
                                    isEditingDescription,
                                    setIsEditingDescription,
                                ]}
                                valueSignal={[description, setDescription]}
                            />
                        </div>
                    </div>
                    <div class="pgn-viewer-bottom">
                        <Show when={!isPuzzleMode()}>
                            <PageNavigator />
                        </Show>
                    </div>
                </TooltipContext.Provider>
            </GameContext.Provider>
            <ShortcutsHelp open={showShortcuts} />
            <Show when={reference()}>
                <Tooltip
                    plyData={ply}
                    reference={reference}
                    orientation={orientation}
                />
            </Show>
        </>
    );
};

export default GameManager;
