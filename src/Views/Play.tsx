import { createEffect, createSignal, For, on, Show } from "solid-js";
import GameManager from "../components/game/GameManager";
import { useSearchParams } from "@solidjs/router";
import { saveHistoryGame } from "../storage/db";
import { getSettingValue, setSettingValue } from "../models/settings";
import { TIME_CONTROLS } from "../models/clock";
import { TIME_CONTROL_SETTING } from "../components/game/useGameClock";
import { TUTOR_SETTING } from "../components/game/useTutor";

/** Ratings to play the tutor at: yours, roughly */
const TUTOR_LEVELS = [600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200];
const CHATTINESS = [
    { value: "quiet", label: "Only blunders" },
    { value: "normal", label: "Mistakes" },
    { value: "chatty", label: "Every slip" },
];

const PlayView = () => {
    const [searchParams, _setSearchParams] = useSearchParams();
    const [newPgn, setNewPgn] = createSignal<string | undefined>(undefined);
    const [timeControl, setTimeControl] = createSignal(
        getSettingValue<string>(TIME_CONTROL_SETTING, "") ?? "",
    );
    const tutorOn = () => !!getSettingValue<boolean>(TUTOR_SETTING, false);

    // Saved after every move, so History has the game even if it is left unfinished
    createEffect(
        on(newPgn, (pgn) => {
            if (pgn) saveHistoryGame(pgn);
        }),
    );

    const initialFen = () => {
        if (typeof searchParams.fen === "string") {
            return searchParams.fen;
        }
        return undefined;
    };

    return (
        <>
            <nav class="game-header buttons buttons-bar" role="navigation">
                <label
                    class="play-tutor checkbox"
                    title="The tutor plays at your level, warns you of threats and asks before you keep a mistake"
                >
                    <input
                        type="checkbox"
                        checked={tutorOn()}
                        onChange={(e) =>
                            void setSettingValue(
                                TUTOR_SETTING,
                                e.currentTarget.checked,
                            )
                        }
                    />{" "}
                    Tutor
                </label>
                <Show
                    when={tutorOn()}
                    fallback={
                        <label
                            class="play-time-control"
                            title="Clocks for the next game (minutes + seconds added per move); the engine plays on its clock"
                        >
                            Time control{" "}
                            <span class="select is-small">
                                <select
                                    value={timeControl()}
                                    onChange={(e) => {
                                        setTimeControl(e.currentTarget.value);
                                        void setSettingValue(
                                            TIME_CONTROL_SETTING,
                                            e.currentTarget.value,
                                        );
                                    }}
                                >
                                    <For each={TIME_CONTROLS}>
                                        {(tc) => (
                                            <option value={tc}>
                                                {tc || "No clock"}
                                            </option>
                                        )}
                                    </For>
                                </select>
                            </span>
                        </label>
                    }
                >
                    <label title="Your rating, roughly: the tutor plays and coaches at it">
                        Your level{" "}
                        <span class="select is-small">
                            <select
                                value={getSettingValue<number>(
                                    "tutor.elo",
                                    1200,
                                )}
                                onChange={(e) =>
                                    void setSettingValue(
                                        "tutor.elo",
                                        +e.currentTarget.value,
                                    )
                                }
                            >
                                <For each={TUTOR_LEVELS}>
                                    {(elo) => (
                                        <option value={elo}>{elo}</option>
                                    )}
                                </For>
                            </select>
                        </span>
                    </label>
                    <label title="Which of your moves the tutor asks about">
                        Asks about{" "}
                        <span class="select is-small">
                            <select
                                value={
                                    getSettingValue<string>(
                                        "tutor.chattiness",
                                        "normal",
                                    ) ?? "normal"
                                }
                                onChange={(e) =>
                                    void setSettingValue(
                                        "tutor.chattiness",
                                        e.currentTarget.value,
                                    )
                                }
                            >
                                <For each={CHATTINESS}>
                                    {(c) => (
                                        <option value={c.value}>
                                            {c.label}
                                        </option>
                                    )}
                                </For>
                            </select>
                        </span>
                    </label>
                </Show>
            </nav>
            <GameManager
                initialFen={initialFen()}
                playingEngine={true}
                setPgn={setNewPgn}
            />
        </>
    );
};

export default PlayView;
