// The tutor's corner of the panel (P2.9, T3): its question about your last move, a hint you
// can ask for step by step, and what it said during the game, newest first. Moves and squares
// in its words light up on the board (BoardText).

import { Component, For, Show } from "solid-js";
import {
    IconAlertTriangle,
    IconBulb,
    IconMoodSmile,
    IconSparkles,
} from "@tabler/icons-solidjs";
import Button from "../common/Button";
import BoardText from "./BoardText";
import { Tutor, TutorMessage } from "./useTutor";
import { getSettingValue } from "../../models/settings";
import "./TutorPanel.scss";

const ICONS: Record<TutorMessage["kind"], Component> = {
    warning: IconAlertTriangle,
    chance: IconSparkles,
    mistake: IconMoodSmile,
    info: IconMoodSmile,
};

/** How many of the tutor's earlier messages stay in sight */
const RECENT = 4;

const TutorPanel: Component<{ tutor: Tutor }> = (props) => {
    const recent = () => props.tutor.messages().slice(-RECENT).reverse();
    const elo = () => getSettingValue<number>("tutor.elo", 1200);

    return (
        <section class="tutor-panel">
            <div class="tutor-title">
                <span>Tutor</span>
                <span class="tutor-level">
                    {props.tutor.thinking()
                        ? "thinking…"
                        : `playing at ${elo()}`}
                </span>
            </div>

            <Show when={props.tutor.question()}>
                {(q) => (
                    <div class="tutor-question">
                        <p>
                            <BoardText text={q().text} fens={() => q().fens} />
                        </p>
                        <div class="tutor-actions">
                            <Button
                                class="is-primary"
                                onClick={() => q().takeBack()}
                            >
                                Take it back
                            </Button>
                            <Button onClick={() => q().keep()}>
                                Keep my move
                            </Button>
                        </div>
                    </div>
                )}
            </Show>

            <Show when={props.tutor.hint()}>
                {(h) => (
                    <div class="tutor-hint">
                        <For each={h().steps.slice(0, h().shown)}>
                            {(step) => <p>{step}</p>}
                        </For>
                        <Show when={h().shown < h().steps.length}>
                            <Button onClick={() => props.tutor.moreHint()}>
                                <IconBulb />
                                {h().shown === 0 ? "Hint" : "More"}
                            </Button>
                        </Show>
                    </div>
                )}
            </Show>

            <ul class="tutor-messages">
                <For
                    each={recent()}
                    fallback={
                        <li class="tutor-quiet">
                            I'll speak up when something matters: a threat
                            against you, a strong move to find, or a move you
                            may want back.
                        </li>
                    }
                >
                    {(m, i) => {
                        const Icon = ICONS[m.kind];
                        return (
                            <li
                                class={`tutor-message ${m.kind}`}
                                classList={{ older: i() > 0 }}
                            >
                                <Icon />
                                <BoardText text={m.text} fens={() => m.fens} />
                            </li>
                        );
                    }}
                </For>
            </ul>
        </section>
    );
};

export default TutorPanel;
