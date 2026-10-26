// The tutor's corner of the panel (P2.9, T3–T4): the summary when a game ends (with puzzles
// to train), its question about your last move, a hint you can ask for step by step, and
// what it said during the game, newest first. Moves and squares in its words light up on
// the board (BoardText).

import { Component, For, Show } from "solid-js";
import {
    IconAlertTriangle,
    IconBulb,
    IconMoodSmile,
    IconSparkles,
} from "@tabler/icons-solidjs";
import Button from "../common/Button";
import BoardText from "./BoardText";
import { useNavigate } from "@solidjs/router";
import { Tutor, TutorMessage } from "./useTutor";
import { getSettingValue, setSettingValue } from "../../models/settings";
import { GameResult } from "../../models/tutor";
import { themeLabel } from "../../models/lichesspuzzle";
import {
    pickNextLichessPuzzle,
    THEME_SETTING,
} from "../../storage/lichesspuzzles";
import { makeToast } from "../common/Toast";
import "./TutorPanel.scss";

const ICONS: Record<TutorMessage["kind"], Component> = {
    warning: IconAlertTriangle,
    chance: IconSparkles,
    mistake: IconMoodSmile,
    info: IconMoodSmile,
};

/** How many of the tutor's earlier messages stay in sight */
const RECENT = 4;

const RESULT_TEXT: Record<GameResult, string> = {
    win: "You won. Well played!",
    draw: "A draw.",
    loss: "You lost this one. Here is what to take from it.",
};

const TutorPanel: Component<{ tutor: Tutor }> = (props) => {
    const navigate = useNavigate();
    const recent = () => props.tutor.messages().slice(-RECENT).reverse();
    const elo = () => getSettingValue<number>("tutor.elo", 1200);

    /** A Lichess puzzle of the theme near your puzzle rating, as on the Puzzles page. */
    const train = async (theme: string) => {
        await setSettingValue(THEME_SETTING, theme);
        const puzzle = await pickNextLichessPuzzle(theme).catch(
            () => undefined,
        );
        if (puzzle) navigate(`/puzzle?source=lichess&id=${puzzle.id}`);
        else
            makeToast(
                "No puzzle of this theme yet: download the Lichess puzzles on the Puzzles page",
            );
    };

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

            <Show when={props.tutor.summary()}>
                {(s) => (
                    <div class="tutor-summary">
                        <p class="tutor-result">{RESULT_TEXT[s().result!]}</p>
                        <Show when={s().mistakes.length}>
                            <p>
                                Costliest moves:{" "}
                                {s()
                                    .mistakes.map(
                                        (m) =>
                                            m.label +
                                            (m.allowed
                                                ? ` (it allowed a ${themeLabel(m.allowed).toLowerCase()})`
                                                : ""),
                                    )
                                    .join(", ")}
                                .
                            </p>
                        </Show>
                        <Show when={s().found.length}>
                            <p>
                                Well found:{" "}
                                {s()
                                    .found.map((m) => m.label)
                                    .join(", ")}
                                .
                            </p>
                        </Show>
                        <Show when={s().missed.length}>
                            <p>
                                Missed chances:{" "}
                                {s()
                                    .missed.map(
                                        (m) =>
                                            m.label +
                                            (m.chance?.motif
                                                ? ` (${themeLabel(m.chance.motif).toLowerCase()})`
                                                : ""),
                                    )
                                    .join(", ")}
                                .
                            </p>
                        </Show>
                        <Show when={!s().mistakes.length && !s().missed.length}>
                            <p>
                                A clean game: no big mistakes, no missed
                                chances.
                            </p>
                        </Show>
                        <Show when={s().train.length}>
                            <div class="tutor-actions">
                                <span>Train:</span>
                                <For each={s().train.slice(0, 3)}>
                                    {(theme) => (
                                        <Button onClick={() => train(theme)}>
                                            {themeLabel(theme)}
                                        </Button>
                                    )}
                                </For>
                            </div>
                        </Show>
                        <Show
                            when={getSettingValue<boolean>("tutor.auto", true)}
                        >
                            <p class="tutor-next">
                                Your level for the next game: {elo()}.
                            </p>
                        </Show>
                    </div>
                )}
            </Show>

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
                        <Show when={!props.tutor.summary()}>
                            <li class="tutor-quiet">
                                I'll speak up when something matters: a threat
                                against you, a strong move to find, or a move
                                you may want back.
                            </li>
                        </Show>
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
