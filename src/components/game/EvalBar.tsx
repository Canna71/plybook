// The evaluation bar beside the board (UX overhaul, step 4a): White's share on the win-
// probability scale, the side at the bottom of the board at the bottom of the bar.

import { Accessor, Show } from "solid-js";
import { Color } from "chessops";
import { Evaluation } from "chessops/pgn";
import { evalBar } from "../../models/evalbar";

export const EvalBar = (props: {
    evaluation: Accessor<Evaluation | undefined>;
    turn: Accessor<Color>;
    orientation: Accessor<Color>;
}) => {
    const bar = () => {
        const e = props.evaluation();
        return e && evalBar(e, props.turn());
    };
    // the bottom part is the side at the bottom of the board
    const bottomShare = () => {
        const b = bar();
        if (!b) return 50;
        return props.orientation() === "white" ? b.white : 100 - b.white;
    };

    return (
        <div
            class="eval-bar"
            classList={{
                flipped: props.orientation() === "black",
                empty: !bar(),
            }}
            title={bar() ? `Evaluation ${bar()!.label}` : "No evaluation yet"}
        >
            <div
                class="eval-bar-bottom"
                style={{ height: `${bottomShare()}%` }}
            />
            <div class="eval-bar-mid" />
            <Show when={bar()}>
                <span
                    class="eval-bar-label"
                    classList={{
                        "at-bottom":
                            (bar()!.favours === "white") ===
                            (props.orientation() === "white"),
                    }}
                >
                    {bar()!.label}
                </span>
            </Show>
        </div>
    );
};
