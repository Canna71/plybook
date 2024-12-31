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
    Switch,
} from "solid-js";
import { makeGame, Path, PlyData } from "../../models/pgn";
import { GameModel } from "../../models/GameModel";
import Moves from "./Moves";
import ButtonBar from "./Buttonbar";
import {
    getPosition,
    isPromotion,
    makeConfig,
    makeMove,
    useSplitter,
} from "../common/utils";
import { Color, Key, Piece, Role } from "chessground/types";
import { chessgroundDests } from "chessops/compat";
import BoardEditor from "../boardeditor/BoardEditor";
import { makeFen, parseFen } from "chessops/fen";
import { GameContext, TooltipContext } from "./GameContext";
import { VDivider } from "../common/VDivider";
import PlayerName from "../boardeditor/PlayerName";
import { PiecesPopup } from "./PiecesPopup";
import { NormalMove, Position } from "chessops";
import "./GameManager.scss";
import { EngineInfo, IChessEngine } from "../../engine/engineinterfaces";
import { getEngineFolder } from "../../storage/fs";
import { ExecutableUCIInterface } from "../../engine/executableuci";
import { UCIEngine } from "../../engine/uciengine";
import { createStore } from "solid-js/store";
import EngineInfoViewer from "./EngineInfoViewer";
import { ReferenceElement } from "@floating-ui/dom";
import { Tooltip } from "../common/Tooltip";
import SetPositionSwitch, { ViewMode } from "./SetPositionSwitch";
import { PlayAudioForMove } from "../audio";

export type GameManagerOptions = {
    pgn?: Accessor<string | undefined>;
    setPgn?: (pgn: string) => void;
    engineColor?: Accessor<Color | undefined>;
    defaultEngineOn?: boolean;
};


type PromotionData = {
    promotionCell: Key;
    move: NormalMove;
};



const GameManager: Component<GameManagerOptions> = ({
    pgn,
    setPgn,
    engineColor,
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
    // #endregion

    // #region view mode state
    const [viewMode, setViewMode] = createSignal<ViewMode>(ViewMode.MOVES);
    // #endregion

    // #region Engine state
    const [engineOn, setEngineOn] = createSignal<boolean>(defaultEngineOn);
    // const [engineColor, setEngineColor] = createSignal<Color | undefined>(
    //     undefined,
    // );
    const [engineFolder, _others] = createResource(() =>
        getEngineFolder("stockfish-aarch64-apple-darwin"),
    );
    const [engine, setEngine] = createSignal<IChessEngine | undefined>(
        undefined,
    );
    const [engineInfo, setEngineInfo] = createStore<EngineInfo[]>([]);
    // #endregion

    // #region Layout
    let chessBoardDiv: HTMLDivElement | null = null;
    const divider = useSplitter();
    // #endregion

    // #region Game Setup
    createEffect(() => {
        // const cg = api();
        let pgnString = pgn?.();
        if (!pgnString) {
            pgnString = "[]";
        }
        const gameModel = makeGame(pgnString);
        batch(() => {
            setGame(gameModel);
            if (gameModel.headers.get("FEN")) {
                const setup = parseFen(gameModel.headers.get("FEN") || "");
                if (setup.isOk) {
                    setStartingPosition(makeFen(setup.value));
                }
            }
            setCurrentPath(gameModel.pathAtMainlinePly(0));
        });
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
                console.debug("TODO: Promotion");
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

    const config = () => {
        const baseConfig = makeConfig(game, currentPath, squareHovered)();

        const pos = position();
        const isCheck = pos.isCheck();
        const allDests = chessgroundDests(pos);

        // movable color is current color if not playing against engine
        const movableColor =
            engineColor?.() && pos.turn === engineColor?.() ? undefined : pos.turn;

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

    const isEditable = () => {
        if (!setPgn) return false;

        return true;
    };

    // #endregion

    // #region Starting Position Editing
    const onEditStartingPosition = () => {
        setViewMode(ViewMode.STARTING_POSITION);
    };

    const onAcceptStartingPosition = () => {
        game()?.headers.set("FEN", startingPosition() || "");
        game()?.headers.set("Setup", "1");
        setPgn?.(game()?.pgn() || "");
        setViewMode(ViewMode.MOVES);
    };

    const onCancelStartingPosition = () => {
        setViewMode(ViewMode.MOVES);
    };

    // #endregion

    // #region Game Manipulation

    const applyMove = (move: NormalMove) => {
        const g = game();
        if (!g) {
            return;
        }
        const path = currentPath() || Path.root;
        const p = position();
        const isCapture = p.board.has(move.to);
        const [newGameModel, newPath] = g.applyMoves(path, [move]);
        const newPos = newGameModel.dataAt(newPath)?.pos;
        const isCheck = !!newPos?.isCheck();
        const isCheckmate = !!newPos?.isCheckmate();
        const isSelf = turn() === 'white';
        PlayAudioForMove(isCapture, isCheck, isCheckmate, isSelf);
        batch(() => {
            setGame(newGameModel);
            setCurrentPath(newPath);
        });
    };

    // #endregion

    // #region Effects

    createEffect(() => {
        const newPgn = game()?.pgn();
        if (newPgn &&   newPgn !== pgn?.()) {
            console.log("Setting PGN", newPgn, pgn?.());
            setPgn?.(newPgn);
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
            console.log("Engine not needed",engineOn(), engineColor?.(), engineFolder(), engine());
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
        if (!engineColor?.() || (engineColor?.() != turn())) {
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
            console.log("Analyzing position", fenStr);
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
            <GameContext.Provider
                value={{
                    game: game,
                    setGame: setGame,
                    currentPath: currentPath,
                    setCurrentPath: setCurrentPath,
                    setSquareHovered: setSquareHovered,
                    editable: isEditable,
                }}
            >
                <TooltipContext.Provider value={{ showTooltip }}>
                    <div class="pgnviewer-container">
                        <div class="pgnviewer-content">
                            <Switch>
                                <Match when={viewMode() === ViewMode.MOVES}>
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
                                                    promotionData()
                                                        ?.promotionCell
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
                                </Match>
                                <Match
                                    when={
                                        viewMode() ===
                                        ViewMode.STARTING_POSITION
                                    }
                                >
                                    <BoardEditor
                                        fen={startingPosition}
                                        setFen={setStartingPosition}
                                    />
                                </Match>
                            </Switch>
                        </div>
                        <VDivider ref={divider!} />
                        <div class="pgnviewer-sidebar">
                            
                            <Show when={engineCallable() && !engineColor?.()}>
                                <EngineInfoViewer engineInfo={engineInfo} />
                            </Show>
                            <Show when={hasMoves()}>
                                <div class="pgnviewer-moves-wrapper">
                                    <Moves />
                                </div>
                                <ButtonBar
                                    game={game}
                                    currentPath={currentPath}
                                    setCurrentPath={setCurrentPath}
                                />
                            </Show>
                            <Show when={!hasMoves()}>
                                <SetPositionSwitch
                                    viewMode={viewMode}
                                    onEditStartingPosition={
                                        onEditStartingPosition
                                    }
                                    onAcceptStartingPosition={
                                        onAcceptStartingPosition
                                    }
                                    onCancelStartingPosition={
                                        onCancelStartingPosition
                                    }
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
