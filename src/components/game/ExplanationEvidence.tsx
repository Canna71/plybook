// What a move's explanation rests on (models/explain.ts MoveExplanation, docs/EXPLANATIONS.md),
// folded away under it: in the Engine section and in the review's key moments.

import { Component, For, Show } from "solid-js";
import BoardText from "./BoardText";
import { MoveExplanation, MoverScore } from "../../models/explain";
import "./ExplanationEvidence.scss";

/** A score from the mover's side: "+0.30", "mate in 2", "mated in 1" */
const scoreText = (s: MoverScore | undefined) =>
    !s
        ? "?"
        : s.type === "mate"
          ? s.value > 0
              ? `mate in ${s.value}`
              : `mated in ${-s.value}`
          : `${s.value >= 0 ? "+" : ""}${(s.value / 100).toFixed(2)}`;

const LINE_LABELS = { reply: "Answer", best: "Better" };

/**
 * Verified facts and lines, interpretations marked as such, the scores with their side and
 * depth, and what the analysis could not see.
 */
const ExplanationEvidence: Component<{ explanation: MoveExplanation }> = (
    props,
) => {
    const x = () => props.explanation;
    return (
        <details class="explanation-evidence">
            <summary>Evidence</summary>
            <div class="explanation-evidence-body">
                <Show
                    when={
                        x().evaluation.before !== undefined ||
                        x().evaluation.after !== undefined
                    }
                >
                    <div>
                        Scores for {x().side === "white" ? "White" : "Black"}:{" "}
                        {scoreText(x().evaluation.before)} before,{" "}
                        {scoreText(x().evaluation.after)} after
                        <Show when={x().evaluation.depth !== undefined}>
                            {" "}
                            (depth {x().evaluation.depth})
                        </Show>
                    </div>
                </Show>
                <ul>
                    <For each={x().evidence}>
                        {(e) => (
                            <li classList={{ inferred: !e.verified }}>
                                {e.verified
                                    ? e.basis === "board"
                                        ? "On the board: "
                                        : "In the line: "
                                    : "Interpretation: "}
                                {e.text}
                            </li>
                        )}
                    </For>
                </ul>
                <For each={x().lines}>
                    {(line) => (
                        <div>
                            {LINE_LABELS[line.label]}:{" "}
                            <BoardText
                                text={line.san.join(" ")}
                                fens={() => [line.fen]}
                            />
                        </div>
                    )}
                </For>
                <For each={[...x().limits, ...x().validation.problems]}>
                    {(limit) => <div class="explanation-limit">{limit}</div>}
                </For>
            </div>
        </details>
    );
};

export default ExplanationEvidence;
