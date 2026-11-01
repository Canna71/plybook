// The game manager's board column: the players (names, material, clocks) above and below
// the board, the evaluation bar beside it, the promotion popup; or the position editor while
// the starting position is edited.

import { Accessor, Component, Show, useContext } from "solid-js";
import { Config } from "chessground/config";
import { Color, Key, Role } from "chessground/types";
import { Evaluation } from "chessops/pgn";
import { Chessboard } from "../common/chessboard";
import { otherColor } from "../../models/chessutil";
import BoardEditor from "../boardeditor/BoardEditor";
import PlayerName from "../boardeditor/PlayerName";
import { GameContext } from "./GameContext";
import { ViewMode } from "./PgnEditBar";
import { PiecesPopup } from "./PiecesPopup";
import { ClockFace, GameClock } from "./useGameClock";
import { EvalBar } from "./EvalBar";
import DrawBar, { penColour } from "./DrawBar";

type BoardAreaProps = {
    config: () => Config;
    turn: Accessor<Color>;
    /** Fits the board to the column (not in a side panel) */
    fit: boolean;
    clock?: GameClock;
    showEvalBar: Accessor<boolean>;
    evaluation: Accessor<Evaluation | undefined>;
    /** The square a pawn is promoting on, while its piece is being chosen */
    promotionCell: Accessor<Key | undefined>;
    onPromotionSelected: (role: Role, color: Color) => void;
    /** Pen mode (U.2): drawing with a plain click or drag; the bar shows only when given */
    pen?: { on: Accessor<boolean>; setOn: (on: boolean) => void };
};

const BoardArea: Component<BoardAreaProps> = (props) => {
    const {
        gameSignal: [game, setGame],
        viewModeSignal: [viewMode],
        startingPositionSignal: [startingPosition, setStartingPosition],
        orientation,
        isPuzzleMode,
        engineColorSignal: [engineColor],
        isPlayingOnSignal: [isPlayingOn],
    } = useContext(GameContext)!;

    /** Playing the engine: whose move it is in the game (F.27), whatever position is shown */
    const toMove = (): Color | undefined => {
        const g = game();
        if (!isPlayingOn() || !g) return undefined;
        const end = g.mainline.at(-1)?.pos ?? g.initial.pos;
        return end.isEnd() ? undefined : end.turn;
    };

    let chessBoardDiv: HTMLDivElement | undefined;

    const setPlayer = (color: Color, name: string) => {
        const g = game();
        if (g)
            setGame(
                g.updateHeaders(
                    new Map([[color === "white" ? "White" : "Black", name]]),
                ),
            );
    };

    /** The player on the board's top or bottom edge, with the clock; the bottom one also has the
     * drawing bar, in the row the board already leaves room for */
    const Player = (p: { side: Accessor<Color>; drawing?: boolean }) => (
        <div class="board-player">
            <Show when={!isPuzzleMode()}>
                {/* keyed: a flipped board makes a new name, PlayerName reads its color once */}
                <Show when={p.side()} keyed>
                    {(color) => (
                        <PlayerName
                            name={() =>
                                game()?.players[color].name ||
                                (color === "white" ? "White" : "Black")
                            }
                            setName={(name) => setPlayer(color, name)}
                            color={color}
                        />
                    )}
                </Show>
            </Show>
            <Show when={toMove() === p.side()}>
                <span
                    class="board-turn"
                    classList={{ thinking: engineColor() === p.side() }}
                >
                    {engineColor() === p.side() ? "Thinking…" : "Your move"}
                </span>
            </Show>
            <Show when={p.drawing && props.pen}>
                {(pen) => <DrawBar penOn={pen().on} setPenOn={pen().setOn} />}
            </Show>
            <Show when={props.clock}>
                {(clock) => <ClockFace clock={clock()} color={p.side()} />}
            </Show>
        </div>
    );

    return (
        <div
            class="pgnviewer-content"
            classList={{
                // the board fits the column's width and height
                "board-fit": props.fit,
                "with-eval-bar": props.showEvalBar(),
            }}
        >
            <Show
                when={
                    viewMode() === ViewMode.MOVES || viewMode() === ViewMode.PGN
                }
            >
                <Player side={() => otherColor(orientation())} />
                <div class="board-row">
                    <Show when={props.showEvalBar()}>
                        <EvalBar
                            evaluation={props.evaluation}
                            turn={props.turn}
                            orientation={orientation}
                        />
                    </Show>
                    <div ref={chessBoardDiv} class="pgnviewer-chessboard">
                        <Chessboard
                            config={props.config}
                            pen={() =>
                                props.pen?.on() ? penColour() : undefined
                            }
                        />
                        <Show when={!!props.promotionCell()}>
                            <PiecesPopup
                                chessBoardDiv={chessBoardDiv!}
                                promotingCell={props.promotionCell}
                                orientation={orientation}
                                onSelected={props.onPromotionSelected}
                                color={props.turn}
                            />
                        </Show>
                    </div>
                </div>
                <Player side={orientation} drawing />
            </Show>
            <Show when={viewMode() === ViewMode.STARTING_POSITION}>
                <BoardEditor
                    fen={startingPosition}
                    setFen={setStartingPosition}
                />
            </Show>
        </div>
    );
};

export default BoardArea;
