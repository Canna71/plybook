import { Chessboard } from "../common/chessboard";
import {
    Accessor,
    batch,
    Component,
    createEffect,
    createMemo,
    createSignal,
    Show,
} from "solid-js";
import { Path } from "../../models/pgn";
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
import { makeFen } from "chessops/fen";
import { GameContext, GameContextType, TooltipContext } from "./GameContext";
import { VDivider } from "../common/VDivider";
import PlayerName from "../boardeditor/PlayerName";
import { PiecesPopup } from "./PiecesPopup";
import { NormalMove } from "chessops";
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

    const [description, setDescription] = createSignal<string>("");
    const [isEditingDescription, setIsEditingDescription] = createSignal(false);
    // #endregion

    // #region view mode state
    const [viewMode, setViewMode] = createSignal<ViewMode>(ViewMode.MOVES);
    // #endregion

    // const [engineColor, setEngineColor] = createSignal<Color | undefined>(
    //     undefined,
    // );
    // #endregion
    const isEditable = () => {
        return editable?.() || false;
    };
    // #region Game Context

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
        const path = memoPath();
        if ((path?.size() || 0) === 0) return;
        if (path) {
            const ply = memoDataAtPath();
            setTimeout(() => {
                playSoundForMove(ply, path, game()!);
            }, 1);
        }
    });

    // #endregion

    // #region Engine

    const { engineInfo, engineCallable, engineOnSignal } = useChessEngine({
        defaultEngineOn,
        engineColor,
        game,
        turn,
        applyMove,
        fen,
    });

    const gameContext = {
        gameSignal: [game, setGame],
        currentPathSignal: [currentPath, setCurrentPath],
        startingPositionSignal: [startingPosition, setStartingPosition],
        viewModeSignal: [viewMode, setViewMode],
        editPgnSignal: [editPgn, setEditPgn],
        engineOnSignal,
        descriptionSignal: [description, setDescription],
        isEditingDescriptionSignal: [
            isEditingDescription,
            setIsEditingDescription,
        ],
        setSquareHovered: setSquareHovered,
        editable: isEditable,
    } as GameContextType;
    // #endregion

    // #region tooltip
    const { reference, ply, showTooltip } = useTooltip();

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
                            <Show
                                when={
                                    hasMoves() && viewMode() === ViewMode.MOVES
                                }
                            >
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
