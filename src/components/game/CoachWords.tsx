// "Say it as a coach" (P2.4b): an explanation worded by the model, on request, under the
// Engine section's explanation and a review's key moment (F.36). The wording belongs to the
// text it came from, so a new move or a deeper analysis shows the button again.

import { Accessor, Component, createSignal, Show } from "solid-js";
import { modelStatus, rephrase } from "../../storage/model";
import { coachBrief, rewordingProblems } from "../../models/coach";
import type { MoveExplanation } from "../../models/explain";
import { makeErrorToast } from "../common/Toast";
import BoardText from "./BoardText";
import "./CoachWords.scss";

const CoachWords: Component<{
    /** The computed explanation, with its evidence */
    explanation: MoveExplanation;
    /** The positions it talks about, for BoardText */
    fens: Accessor<string[]>;
}> = (props) => {
    const [coached, setCoached] = createSignal<{
        from: string;
        text: string;
    }>();
    const [coaching, setCoaching] = createSignal(false);
    // the model gets the evidence too (F.37d), and is checked against all of it
    const brief = () => coachBrief(props.explanation);
    const coach = async () => {
        const from = brief();
        setCoaching(true);
        try {
            const text = await rephrase(from);
            // moves, squares or claims the evidence does not have: the computed text stays
            const added = rewordingProblems(from, text);
            if (added.length) {
                makeErrorToast(
                    `The model added things of its own (${added.join(", ")}), so its wording is not shown.`,
                );
            } else {
                setCoached({ from, text });
            }
        } catch (err) {
            makeErrorToast(String(err));
        } finally {
            setCoaching(false);
        }
    };
    const coachText = () => {
        const c = coached();
        return c && c.from === brief() ? c.text : undefined;
    };

    return (
        <Show when={modelStatus()?.provider && props.explanation.text.length}>
            <Show
                when={coachText()}
                fallback={
                    <button
                        class={`button is-small is-text coach-words-button ${coaching() ? "is-loading" : ""}`}
                        disabled={coaching()}
                        onClick={coach}
                    >
                        Say it as a coach
                    </button>
                }
            >
                {(text) => (
                    <div class="coach-words">
                        <span class="coach-words-label">
                            The coach's reading
                        </span>
                        <BoardText text={text()} fens={props.fens} />
                    </div>
                )}
            </Show>
        </Show>
    );
};

export default CoachWords;
