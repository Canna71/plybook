import { Chessboard } from "../common/chessboard";
import {
    Accessor,
    batch,
    Component,
    createEffect,
    createMemo,
    createSignal,
    Match,
    Setter,
    Show,
    Signal,
    Switch,
    untrack,
} from "solid-js";
import { getMaterial, makeGameInternal, Path } from "../../models/pgn";
import { GameModel } from "../../models/GameModel";
import Moves from "./Moves";
import ButtonBar from "./Buttonbar";
import {
    getPosition,
    initFromGameModel,
    isPromotion,
    makeArrowShape,
    makeConfig,
    makeMove,
    otherColor,
    useFen,
    usePosition,
    useSplitter,
} from "../common/utils";
import { Color, Key, Piece, Role, SquareClasses } from "chessground/types";
import { chessgroundDests } from "chessops/compat";
import BoardEditor from "../boardeditor/BoardEditor";
import { INITIAL_FEN, makeFen } from "chessops/fen";
import {
    GameContext,
    GameContextType,
    HintType,
    TooltipContext,
} from "./GameContext";
import { VDivider } from "../common/VDivider";
import PlayerName from "../boardeditor/PlayerName";
import { PiecesPopup } from "./PiecesPopup";
import { makeSquare, NormalMove, parseUci } from "chessops";
import "./GameManager.scss";
import { getDefaultStudyContent } from "../../storage/fs";
import EngineInfoViewer from "./EngineInfoViewer";
import { Tooltip } from "../common/Tooltip";
import PgnEditBar, { ViewMode } from "./PgnEditBar";
import PgnTextArea from "./PgnTextArea";
import { useChessEngine } from "./useChessEngine";
import { playSoundForMove } from "./playSoundForMove";
import { useTooltip } from "./useTooltip";
import MarkdownEditor from "../common/MarkdownEditor";
import { Game, makePgn, parsePgn, PgnNodeData } from "chessops/pgn";
import PageNavigator from "./MultiPage";
import EngineControl from "./EngineControl";
import { getSettingValue, setSettingValue } from "../../models/settings";
import { Config } from "chessground/config";

export type GameManagerOptions = {
    initalPgn?: Accessor<string | undefined>;
    setPgn?: (pgn: string) => void;
    // engineColor?: Accessor<Color | undefined>;
    playingEngine?: boolean;
    defaultEngineAnalysisOn?: boolean;
    initialFen?: string;
    editable?: Accessor<boolean>;
};

type PromotionData = {
    promotionCell: Key;
    move: NormalMove;
};

// render the right <PlayerName />  component depending if the board is flipped or not

type PlayerNameSelectorProps = {
    color: Color;
    orientation: Accessor<Color>;
    whitePlayerSignal: Signal<string>;
    blackPlayerSignal: Signal<string>;
};

const PlayerNameSelector: Component<PlayerNameSelectorProps> = (props) => {
    return (
        <Switch>
            <Match when={props.color === props.orientation()}>
                <PlayerName
                    name={props.whitePlayerSignal[0]}
                    setName={props.whitePlayerSignal[1]}
                    color={"white"}
                />
            </Match>
            <Match when={true}>
                <PlayerName
                    name={props.blackPlayerSignal[0]}
                    setName={props.blackPlayerSignal[1]}
                    color={"black"}
                />
            </Match>
        </Switch>
    );
};

const GameManager: Component<GameManagerOptions> = ({
    initalPgn: initialPgn,
    setPgn,
    playingEngine,
    initialFen,
    editable,
    defaultEngineAnalysisOn = false,
}) => {
    // #region Game State
    const [currentPath, setCurrentPath] = createSignal<Path | undefined>(
        new Path(""),
    );
    const [game, setGame] = createSignal<GameModel | undefined>(undefined);
    const [squareHovered, setSquareHovered] = createSignal<string | undefined>(
        undefined,
    );
    const [startingPosition, setStartingPosition] = createSignal<
        string | undefined
    >(initialFen || INITIAL_FEN);
    const [promotionData, setPromotionData] = createSignal<
        PromotionData | undefined
    >(undefined);

    const [editPgn, setEditPgn] = createSignal<string | undefined>(undefined);
    const [fullPgn, setFullPgn] = createSignal<string | undefined>(
        initialPgn?.(),
    );

    const [description, setDescription] = createSignal<string>("");
    const [isEditingDescription, setIsEditingDescription] = createSignal(false);
    // #endregion

    // #region view mode state
    const [viewMode, setViewMode] = createSignal<ViewMode>(ViewMode.MOVES);
    const [gameIndex, setGameIndex] = createSignal(0);
    // #endregion

    const [engineColor, setEngineColor] = createSignal<Color | undefined>(
        undefined,
    );
    const [hintType, setHintType] = createSignal(HintType.None);
    // #endregion
    const isEditable = () => {
        return editable?.() || false;
    };
    // #region Game Context

    // #region Layout
    let chessBoardDiv: HTMLDivElement | null = null;

    const divider = useSplitter((layout) => {
        setSettingValue("layout.playing.columnsTemplate", layout);
    });
    // #endregion

    // #region Event Handlers
    const onManualMove = (orig: Key, dest: Key, _capturedPiece?: Piece) => {
        const g = game();
        if (!g) {
            return;
        }

        const move = makeMove(orig, dest);
        const pos = position();

        const isLegal = pos.isLegal(move);
        if (isLegal) {
            applyMove(move);
        } else {
            // check for promotion
            const promo = isPromotion(move, pos);
            if (promo) {
                const promoData = {
                    promotionCell: dest,
                    move: move,
                };
                setPromotionData(promoData);
                setGame(g.clone());
            } else {
                console.debug("Illegal move");
                setGame(g.clone());
            }
        }
    };

    const onSelect = (_key: Key) => {};

    const onDrawChange = (shapes: any) => {
        const ng = game()?.updateShapes(currentPath()!, shapes);
        setGame(ng);
    };

    const onPromotionSelected = (role: Role, _color: Color) => {
        const promoData = promotionData();
        setPromotionData(undefined);
        if (promoData) {
            const move = promoData.move;
            move.promotion = role;
            applyMove(move);
        }
    };

    const setWhitePlayer = (name: string) => {
        const newGame = game()!.updateHeaders(new Map([["White", name]]));
        setGame(newGame);
    };

    const setBlackPlayer = (name: string) => {
        const newGame = game()!.updateHeaders(new Map([["Black", name]]));
        setGame(newGame);
    };

    // #endregion

    // #region Computed Properties

    // const position = createMemo(() => getPosition(game, currentPath));

    // const fen = createMemo(() => makeFen(position().toSetup()));

    const position = usePosition(game, currentPath);

    const fen = useFen(game, currentPath);

    const turn = createMemo(() => position().turn as Color);

    const orientation = createMemo(() => {
        const engCol = engineColor?.();
        if (playingEngine) {
            // if(engCol === "white") {
            //     return "black";
            // } else {
            //     return "white";
            // }
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
    });

    // const playingEngine = () => !!engineColor?.();

    const config = () => {
        const baseConfig: Config = makeConfig(
            game,
            currentPath,
            squareHovered,
            orientation,
        )();
        const pos = position();
        const isCheck = pos.isCheck();
        const allDests = chessgroundDests(pos);

        // movable color is current color if not playing against engine
        let movableColor = undefined;

        if (!!playingEngine) {
            if (engineColor?.() && pos.turn !== engineColor?.()) {
                movableColor = pos.turn;
            }
        } else {
            movableColor = pos.turn;
        }

        const showArrows = !playingEngine && getSettingValue("engine.analysis.showArrows", false);
        const shapes = baseConfig.drawable?.shapes || [];

        const hints: SquareClasses = new Map();
        const hintMove = moveHintSignal[0]();
        if (hintMove) {
            const move = parseUci(hintMove) as NormalMove;
            const from = makeSquare(move.from);
            const to = makeSquare(move.to);
            if (hintType() === HintType.Piece) {
                hints.set(from, "selected");
            } else if (hintType() === HintType.Move) {
                hints.set(from, "selected");
                hints.set(to, "selected");
            }
            if(showArrows) {
                const arrow = makeArrowShape(from, to, "black");
                shapes.push(arrow);
            }
        } else {
            if (engineInfo.length > 0 && showArrows) {
                for (let info of engineInfo) {
                    if (info.pv) {
                        const move = parseUci(info.pv[0]) as NormalMove;
                        const from = makeSquare(move.from);
                        const to = makeSquare(move.to);
                        const arrow = makeArrowShape(from, to, "gray");
                        shapes.push(arrow);
                    }
                }
            }
        }

        const config = {
            ...baseConfig,
            highlight: {
                ...baseConfig.highlight,
                custom: hints,
            },
            draggable: {
                enabled: true,
            },
            viewOnly: false,
            turnColor: pos.turn,
            movable: {
                free: false,
                color: movableColor,
                dests: allDests,
            },
            check: isCheck,
            events: {
                move: onManualMove,

                select: onSelect,
            },
            drawable: {
                ...baseConfig.drawable,
                shapes: shapes,
                eraseOnClick: false,
                onChange: onDrawChange,
            },
        };


        return config;
    };

    const hasMoves = createMemo(() => game()?.mainline?.length ?? 0 > 0);

    const whitePlayer = () => game()?.players.white.name || "White";

    const blackPlayer = () => game()?.players.black.name || "Black";

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
        const g = game();
        if (!g) {
            return;
        }
        const path = currentPath() || Path.root;
        const [newGameModel, newPath] = g.applyMoves(path, [move]);
        batch(() => {
            setHintType(HintType.None);
            setGame(newGameModel);
            setCurrentPath(newPath);
        });
    };

    // #endregion

    // #region Effects

    createEffect(() => {
        let pgnString = initialPgn?.();
        // if (!pgnString) {
        //     pgnString = getDefaultStudyContent();
        // }
        // const games = parsePgn(pgnString);
        // const gameModel = makeGameInternal(games[0]);

        batch(() => {
            // setGameIndex(0);
            setFullPgn(pgnString);
            // initFromGameModel(gameContext, gameModel);
            // updateGameFromPgnString(pgnString, gameContext);
        });
    });

    // this is a  effect triggered when the game changes
    createEffect(() => {
        const gIdx = untrack(gameIndex);
        const fPgn = untrack(fullPgn);

        const g = game();
        if (!g) return;
        let path = currentPath();
        let data = path && g.dataAt(path);

        // const _updPgn = g.pgn();

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

    createEffect(() => {
        // play sound when path changes
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
            const gameModel = makeGameInternal(parsePgn("[]]")[0])
            .withStartingPosition(initialFen);
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
        engineLevelSignal,
        moveHintSignal,
    } = useChessEngine({
        defaultEngineAnalysisOn,
        engineColor,
        game,
        path: currentPath,
        turn,
        applyMove,
        fen,
        playingEngine: () => !!playingEngine,
    });

    const gameContext = {
        // pgn: pgn,
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
        setSquareHovered: setSquareHovered,
        editable: isEditable,
        engineColorSignal: [engineColor, setEngineColor],
        engineLevelSignal,
        moveHintSignal,
        hintTypeSignal: [hintType, setHintType],
    } as GameContextType;
    // #endregion

    // #region tooltip
    const { reference, ply, showTooltip } = useTooltip();

    // #endregion

    return (
        <>
            <GameContext.Provider value={gameContext}>
                <TooltipContext.Provider value={{ showTooltip }}>
                    <div
                        class="pgnviewer-container"
                        style={{
                            "grid-template-columns": getSettingValue(
                                "layout.playing.columnsTemplate",
                                "400px 5px 1fr",
                            ),
                        }}
                    >
                        <div class="pgnviewer-content">
                            <Show
                                when={
                                    viewMode() === ViewMode.MOVES ||
                                    viewMode() === ViewMode.PGN
                                }
                            >
                                <PlayerNameSelector
                                    color={"black"}
                                    orientation={orientation}
                                    whitePlayerSignal={[
                                        whitePlayer,
                                        setWhitePlayer as Setter<string>,
                                    ]}
                                    blackPlayerSignal={[
                                        blackPlayer,
                                        setBlackPlayer as Setter<string>,
                                    ]}
                                />
                                <div
                                    ref={chessBoardDiv!}
                                    class="pgnviewer-chessboard"
                                >
                                    <Chessboard config={config} />
                                    <Show when={!!promotionData()}>
                                        <PiecesPopup
                                            chessBoardDiv={chessBoardDiv}
                                            promotingCell={() =>
                                                promotionData()?.promotionCell
                                            }
                                            onSelected={onPromotionSelected}
                                            color={turn}
                                        />
                                    </Show>
                                </div>
                                <PlayerNameSelector
                                    color={"white"}
                                    orientation={orientation}
                                    whitePlayerSignal={[
                                        whitePlayer,
                                        setWhitePlayer as Setter<string>,
                                    ]}
                                    blackPlayerSignal={[
                                        blackPlayer,
                                        setBlackPlayer as Setter<string>,
                                    ]}
                                />
                            </Show>
                            <Show
                                when={viewMode() === ViewMode.STARTING_POSITION}
                            >
                                <BoardEditor
                                    fen={startingPosition}
                                    setFen={setStartingPosition}
                                />
                            </Show>
                        </div>
                        <VDivider ref={divider!} />
                        <div class="pgnviewer-sidebar">
                            <Show when={true}>
                                <PgnEditBar isEditable={isEditable} />
                            </Show>
                            <Show when={true}>
                                <EngineControl />
                            </Show>
                            <Show when={engineCallable() && !playingEngine}>
                                <EngineInfoViewer engineInfo={engineInfo} />
                            </Show>
                            <div class="pgnviewer-moves-wrapper">
                                <Show
                                    when={
                                        hasMoves() &&
                                        viewMode() === ViewMode.MOVES
                                    }
                                >
                                    <Moves />
                                </Show>
                            </div>
                            <Show when={viewMode() === ViewMode.MOVES}>
                                <ButtonBar />
                            </Show>

                            <Show when={viewMode() === ViewMode.PGN}>
                                <PgnTextArea
                                    pgnSignal={[editPgn, setEditPgn]}
                                />
                            </Show>
                        </div>

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
                        <PageNavigator />
                    </div>
                </TooltipContext.Provider>
            </GameContext.Provider>
            <Show when={reference()}>
                <Tooltip plyData={ply} reference={reference} />
            </Show>
        </>
    );
};

export default GameManager;
