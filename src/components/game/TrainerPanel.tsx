// The training frame (UX overhaul, step 6): what to do, how it's going, hints, and what
// next. Shared by puzzles, mistakes and the other trainers, so they all feel the same.

import { Accessor, JSX, ParentComponent, Show } from "solid-js";
import { Color } from "chessops";
import {
    IconBulb,
    IconCheck,
    IconCircleCheckFilled,
    IconX,
} from "@tabler/icons-solidjs";
import Button from "../common/Button";
import "./TrainerPanel.scss";

/** solving: your move; good: right so far; wrong: not the move; solved: done */
export type TrainerStatus = "solving" | "good" | "wrong" | "solved";

const STATUS_TEXT: Record<TrainerStatus, string> = {
    solving: "Your move",
    good: "Good move: keep going",
    wrong: "Not the move",
    solved: "Solved!",
};

const TrainerPanel: ParentComponent<{
    title: string;
    /** Where you are: "Move 3 of 20", "4 to review" */
    progress?: Accessor<string | undefined>;
    /** The side to find the move for */
    side: Accessor<Color>;
    /** The task, if not "Find the best move for White." */
    prompt?: Accessor<string | undefined>;
    status: Accessor<TrainerStatus>;
    /** Says more than the status: "Not your repertoire move: here you play Nf3." */
    message?: Accessor<string | undefined>;
    /** A line under the status: a rating change, a score */
    note?: Accessor<string | undefined>;
    onHintPiece?: () => void;
    onHintMove?: () => void;
    onRetry?: () => void;
    onNext?: () => void;
    nextLabel?: string;
    onAnalyze?: () => void;
    /** More actions, shown with Next and Analyze */
    actions?: JSX.Element;
}> = (props) => {
    const solving = () => props.status() !== "solved";

    return (
        <section class="trainer-panel" classList={{ [props.status()]: true }}>
            <div class="trainer-title">
                <span>{props.title}</span>
                <Show when={props.progress?.()}>
                    <span class="trainer-progress">{props.progress!()}</span>
                </Show>
            </div>
            <div class="trainer-prompt">
                <span class={`trainer-side ${props.side()}`} />
                {props.prompt?.() ??
                    (props.status() === "solved"
                        ? "Well done."
                        : `Find the best move for ${props.side() === "white" ? "White" : "Black"}.`)}
            </div>

            <div class="trainer-status">
                <Show when={props.status() === "good"}>
                    <IconCheck />
                </Show>
                <Show when={props.status() === "wrong"}>
                    <IconX />
                </Show>
                <Show when={props.status() === "solved"}>
                    <IconCircleCheckFilled />
                </Show>
                <span>{props.message?.() ?? STATUS_TEXT[props.status()]}</span>
                <Show when={props.status() === "wrong" && props.onRetry}>
                    <Button class="is-small" onClick={() => props.onRetry!()}>
                        Try again
                    </Button>
                </Show>
            </div>
            <Show when={props.note?.()}>
                <p class="trainer-note">{props.note!()}</p>
            </Show>

            {props.children}

            <div class="trainer-actions">
                <Show
                    when={solving() && (props.onHintPiece || props.onHintMove)}
                >
                    <Show when={props.onHintPiece}>
                        <Button
                            title="Highlight the piece to move"
                            onClick={() => props.onHintPiece!()}
                        >
                            <IconBulb />
                            Hint
                        </Button>
                    </Show>
                    <Show when={props.onHintMove}>
                        <Button
                            title="Show the move"
                            onClick={() => props.onHintMove!()}
                        >
                            Show the move
                        </Button>
                    </Show>
                </Show>
                <Show when={props.onNext}>
                    <Button
                        class={props.status() === "solved" ? "is-primary" : ""}
                        onClick={() => props.onNext!()}
                    >
                        {props.nextLabel ?? "Next"}
                    </Button>
                </Show>
                <Show when={!solving() && props.onAnalyze}>
                    <Button onClick={() => props.onAnalyze!()}>Analyze</Button>
                </Show>
                {props.actions}
            </div>
        </section>
    );
};

export default TrainerPanel;
