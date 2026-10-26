// Text that points at the board: squares and moves in it light up on the board when hovered,
// as in PGN comments. Moves are resolved in `fens`, the positions the text talks about
// (models/boardtext.ts). The text is ours (explanations), rendered as elements, never as HTML.

import { Accessor, Component, createMemo, For, useContext } from "solid-js";
import { boardText } from "../../models/boardtext";
import { GameContext } from "./GameContext";
import "./BoardText.scss";

const BoardText: Component<{ text: string; fens: Accessor<string[]> }> = (
    props,
) => {
    const {
        highlightedSquaresSignal: [, setSquares],
        highlightedMovesSignal: [, setMoves],
    } = useContext(GameContext)!;
    const pieces = createMemo(() => boardText(props.text, props.fens()));
    const clear = () => {
        setSquares?.([]);
        setMoves?.([]);
    };

    return (
        <span class="board-text" onMouseLeave={clear}>
            <For each={pieces()}>
                {(piece) =>
                    "square" in piece ? (
                        <span
                            class="board-ref"
                            onMouseEnter={() => setSquares?.([piece.square])}
                            onMouseLeave={clear}
                        >
                            {piece.text}
                        </span>
                    ) : "from" in piece ? (
                        <span
                            class="board-ref is-move"
                            onMouseEnter={() =>
                                setMoves?.([`${piece.from}-${piece.to}`])
                            }
                            onMouseLeave={clear}
                        >
                            {piece.text}
                        </span>
                    ) : (
                        piece.text
                    )
                }
            </For>
        </span>
    );
};

export default BoardText;
