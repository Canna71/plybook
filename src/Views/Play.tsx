import { createEffect, createSignal, For, on } from "solid-js";
import GameManager from "../components/game/GameManager";
import { useSearchParams } from "@solidjs/router";
import { saveHistoryGame } from "../storage/db";
import { getSettingValue, setSettingValue } from "../models/settings";
import { TIME_CONTROLS } from "../models/clock";
import { TIME_CONTROL_SETTING } from "../components/game/useGameClock";

const PlayView = () => {
    const [searchParams, _setSearchParams] = useSearchParams();
    const [newPgn, setNewPgn] = createSignal<string | undefined>(undefined);
    const [timeControl, setTimeControl] = createSignal(
        getSettingValue<string>(TIME_CONTROL_SETTING, "") ?? "",
    );

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
