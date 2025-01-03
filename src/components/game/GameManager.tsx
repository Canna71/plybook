import { Chessboard } from "../common/chessboard";
import {
    Accessor,
    batch,
    Component,
    createEffect,
    createMemo,
    createResource,
    createSignal,
    Match,
    onCleanup,
    Show,
    Signal,
    Switch,
} from "solid-js";
import { isPlyData, makeGame, Path, PlyData } from "../../models/pgn";
import { GameModel } from "../../models/GameModel";
import Moves from "./Moves";
import ButtonBar from "./Buttonbar";
import {
    getPosition,
    isPromotion,
    makeConfig,
    makeMove,
    updateGameFromPgnString,
    useSplitter,
} from "../common/utils";
import { Color, Key, Piece, Role } from "chessground/types";
import { chessgroundDests } from "chessops/compat";
import BoardEditor from "../boardeditor/BoardEditor";
import { makeFen, parseFen } from "chessops/fen";
import { GameContext, GameContextType, TooltipContext } from "./GameContext";
import { VDivider } from "../common/VDivider";
import PlayerName from "../boardeditor/PlayerName";
import { PiecesPopup } from "./PiecesPopup";
import { NormalMove, Position, squareRank } from "chessops";
import "./GameManager.scss";
import { EngineInfo, IChessEngine } from "../../engine/engineinterfaces";
import { getDefaultStudyContent, getEnginePath } from "../../storage/fs";
import { ExecutableUCIInterface } from "../../engine/executableuci";
import { UCIEngine } from "../../engine/uciengine";
import { createStore } from "solid-js/store";
import EngineInfoViewer from "./EngineInfoViewer";
import { ReferenceElement } from "@floating-ui/dom";
import { Tooltip } from "../common/Tooltip";
import PgnEditBar, { ViewMode } from "./PgnEditBar";
import { PlayAudioForMove } from "../audio";
import PgnTextArea from "./PgnTextArea";

export type GameManagerOptions = {
    pgn?: Accessor<string | undefined>;
    setPgn?: (pgn: string) => void;
    engineColor?: Accessor<Color | undefined>;
    defaultEngineOn?: boolean;
    editable?: Accessor<boolean>;
};

type PromotionData = {
    promotionCell: Key;
    move: NormalMove;
};

const GameManager: Component<GameManagerOptions> = ({
    pgn,
    setPgn,
    engineColor,
    editable,
    defaultEngineOn = false,
}) => {
    // #region Game State
    const [currentPath, setCurrentPath] = createSignal<Path | undefined>(
        undefined,
    );
    const [game, setGame] = createSignal<GameModel | undefined>(undefined);
    const [squareHovered, setSquareHovered] = createSignal<string | undefined>(
        undefined,
    );
    const [startingPosition, setStartingPosition] = createSignal<
        string | undefined
    >(undefined);
    const [promotionData, setPromotionData] = createSignal<
        PromotionData | undefined
    >(undefined);

    const [editPgn, setEditPgn] = createSignal<string | undefined>(undefined);
    // #endregion

    // #region view mode state
    const [viewMode, setViewMode] = createSignal<ViewMode>(ViewMode.MOVES);
    // #endregion

    // #region Engine state
    const [engineOn, setEngineOn] = createSignal<boolean>(defaultEngineOn);
    // const [engineColor, setEngineColor] = createSignal<Color | undefined>(
    //     undefined,
    // );
    const [engineFolder, _others] = createResource(() => getEnginePath());
    const [engine, setEngine] = createSignal<IChessEngine | undefined>(
        undefined,
    );
    const [engineInfo, setEngineInfo] = createStore<EngineInfo[]>([]);
    // #endregion
    const isEditable = () => {
        return editable?.() || false;
    };
    // #region Game Context

    const gameContext = {
        gameSignal: [game, setGame],
        currentPathSignal: [currentPath, setCurrentPath],
        startingPositionSignal: [startingPosition, setStartingPosition],
        viewModeSignal: [viewMode, setViewMode],
        editPgnSignal: [editPgn, setEditPgn],
        setSquareHovered: setSquareHovered,
        editable: isEditable,
    } as GameContextType;

    // #region Layout
    let chessBoardDiv: HTMLDivElement | null = null;
    const divider = useSplitter();
    // #endregion

    // #region Game Setup
    createEffect(() => {
        // const cg = api();
        let pgnString = pgn?.();
        if (!pgnString) {
            pgnString = getDefaultStudyContent();
        }

        updateGameFromPgnString(pgnString, gameContext);
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
        game()!.players.white.name = name;
        setGame(game()?.clone());
    };

    const setBlackPlayer = (name: string) => {
        game()!.players.black.name = name;
        setGame(game()?.clone());
    };

    // #endregion

    // #region Computed Properties

    const position = createMemo(() => getPosition(game, currentPath));

    const fen = createMemo(() => makeFen(position().toSetup()));

    const turn = createMemo(() => position().turn as Color);

    const editablePgn = () =>
        game()?.pgn() || pgn?.() || getDefaultStudyContent();

    const config = () => {
        const baseConfig = makeConfig(game, currentPath, squareHovered)();

        const pos = position();
        const isCheck = pos.isCheck();
        const allDests = chessgroundDests(pos);

        // movable color is current color if not playing against engine
        const movableColor =
            engineColor?.() && pos.turn === engineColor?.()
                ? undefined
                : pos.turn;

        const config = {
            ...baseConfig,
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
                eraseOnClick: false,
                onChange: onDrawChange,
            },
        };
        return config;
    };

    const hasMoves = createMemo(() => game()?.mainline?.length ?? 0 > 0);

    const whitePlayer = () => game()?.players.white.name || "White";

    const blackPlayer = () => game()?.players.black.name || "Black";

    // #endregion

    // #region Starting Position Editing

    // #endregion

    // #region Game Manipulation

    const applyMove = (move: NormalMove) => {
        const g = game();
        if (!g) {
            return;
        }
        const path = currentPath() || Path.root;
        const [newGameModel, newPath] = g.applyMoves(path, [move]);
        batch(() => {
            setGame(newGameModel);
            setCurrentPath(newPath);
        });
    };

    // #endregion

    // #region Effects

    createEffect(() => {
        const newPgn = game()?.pgn();
        if (newPgn && newPgn !== pgn?.()) {
            setPgn?.(newPgn);
        }
    });

    createEffect(() => {
        // play sound when path changes
        const path = currentPath();
        if ((path?.size() || 0) === 0) return;
        if (path) {
            const ply = game()?.dataAt(path);
            if (isPlyData(ply)) {
                const pos = ply.pos;
                const isCheck = pos.isCheck();
                const isCheckmate = pos.isCheckmate();
                const isSelf = pos.turn === "black"; // self is white
                // determine if move is a capture
                const lastMove = ply.move as NormalMove;
                const previous = path.previous();
                const previousPly = game()?.dataAt(previous);
                const role = pos.board.get(lastMove.to)?.role;
                const isCastling =
                    role === "king" &&
                    Math.abs(
                        squareRank(lastMove.to) - squareRank(lastMove.from),
                    ) === 2;
                const isCapture =
                    previousPly?.pos.board.has(lastMove.to) || false;
                const flags = {
                    isCapture,
                    isCheck,
                    isCheckmate,
                    isSelf,
                    isCastling,
                };
                PlayAudioForMove(flags);
            }
        }
    });

    // #endregion

    // #region Engine

    const engineCallable = () => engine() && engineOn() && engineFolder();

    const shouldInitEngine = () => {
        return (engineOn() || engineColor?.()) && engineFolder() && !engine();
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
                setEngineOn(true);
            });
        } else {
        }
    });

    // cleanup engine when engineOn is false
    createEffect(() => {
        if (!engineOn()) {
            const eng = engine();
            if (eng) {
                eng.quit();
                eng.off("bestmove", onEngineBestMove);
            }
        }
    });

    onCleanup(() => {
        const eng = engine();
        if (eng) {
            eng.quit();
            eng.off("bestmove", onEngineBestMove);
        }
    });

    const onEngineBestMove = (bestMove: string, _ponder: string) => {
        const g = game();
        if (!g) {
            return;
        }
        if (!engineColor?.() || engineColor?.() != turn()) {
            return;
        }
        const m = { from: bestMove.slice(0, 2), to: bestMove.slice(2, 4) };
        const move: NormalMove = makeMove(m.from, m.to);
        applyMove(move);
    };

    const onEngineInfo = (info: EngineInfo) => {
        if (info.multipv) {
            setEngineInfo(info.multipv - 1, info);
        }
    };

    // handles engine processing
    createEffect(() => {
        if (engineCallable()) {
            const fenStr = fen();
            setEngineInfo([]);
            // console.log("Analyzing position", fenStr);
            engine()!.analyzeFromFenOrMoves(fenStr, { depth: 15, multipv: 3 });
        }
    });

    // #endregion

    // #region tooltip
    const [reference, setReference] = createSignal<
        ReferenceElement | null | undefined
    >(undefined);
    const [ply, setPly] = createSignal<PlyData>();

    const showTooltip = (
        anchor: Element | undefined,
        plyData: PlyData | undefined,
    ) => {
        setPly(plyData);
        setReference(anchor);
    };

    // #endregion

    return (
        <>
            <GameContext.Provider value={gameContext}>
                <TooltipContext.Provider value={{ showTooltip }}>
                    <div class="pgnviewer-container">
                        <div class="pgnviewer-content">
                            <Show
                                when={
                                    viewMode() === ViewMode.MOVES ||
                                    viewMode() === ViewMode.PGN
                                }
                            >
                                <PlayerName
                                    name={blackPlayer}
                                    setName={setBlackPlayer}
                                    color="black"
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
                                <PlayerName
                                    name={whitePlayer}
                                    setName={setWhitePlayer}
                                    color="white"
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
                            <Show when={isEditable()}>
                                <PgnEditBar />
                            </Show>
                            <Show when={engineCallable() && !engineColor?.()}>
                                <EngineInfoViewer engineInfo={engineInfo} />
                            </Show>
                            <Show when={hasMoves() && viewMode() === ViewMode.MOVES}>
                                <div class="pgnviewer-moves-wrapper">
                                    <Moves />
                                </div>
                                <ButtonBar
                                    game={game}
                                    currentPath={currentPath}
                                    setCurrentPath={setCurrentPath}
                                />
                            </Show>

                            <Show when={viewMode() === ViewMode.PGN}>
                                <PgnTextArea
                                    pgnSignal={[editPgn, setEditPgn]}
                                />
                            </Show>
                        </div>
                    </div>
                    <div class="pgn-viewer-bottom"></div>
                </TooltipContext.Provider>
            </GameContext.Provider>
            <Show when={reference()}>
                <Tooltip plyData={ply} reference={reference} />
            </Show>
        </>
    );
};

export default GameManager;
