import { Component, For, Show } from "solid-js";
import { Config } from "chessground/config";
import { Chessboard } from "../common/chessboard";
import { getSettingValue, setSettingValue } from "../../models/settings";
import { BOARD_THEMES, PIECE_THEMES } from "../../theming/thememanager";
import {
    BOARD_PRESETS,
    BoardColours,
    CUSTOM_BOARD,
} from "../../models/boardtheme";

const UI_THEMES = [
    { value: "system", label: "Same as the system" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
];

// a position with every piece, to judge a piece set
const PREVIEW: Config = {
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R",
    viewOnly: true,
    coordinates: false,
};

/** Light or dark UI, board colours and piece set; changes apply at once. */
const Appearance: Component = () => {
    const choice = (
        label: string,
        key: "themes.ui" | "themes.board" | "themes.pieces",
        fallback: string,
        options: { value: string; label: string }[],
    ) => (
        <div class="field">
            <label class="label is-small">{label}</label>
            <div class="select is-small">
                <select
                    value={getSettingValue(key, fallback)}
                    onChange={(e) =>
                        void setSettingValue(key, e.currentTarget.value)
                    }
                >
                    <For each={options}>
                        {(o) => <option value={o.value}>{o.label}</option>}
                    </For>
                </select>
            </div>
        </div>
    );
    const named = (names: string[]) =>
        names.map((n) => ({
            value: n,
            label:
                n === CUSTOM_BOARD
                    ? "Custom colours"
                    : (n.charAt(0).toUpperCase() + n.slice(1)).replace(
                          /_/g,
                          " ",
                      ),
        }));

    // the custom board (U.3): its three colours, starting from the preset left behind
    const colours = () =>
        getSettingValue("themes.boardColours") ?? BOARD_PRESETS.classic;
    const setBoard = (name: string) => {
        const left = getSettingValue("themes.board", "bluish");
        if (name === CUSTOM_BOARD && left && left in BOARD_PRESETS)
            void setSettingValue("themes.boardColours", {
                ...BOARD_PRESETS[left],
            });
        void setSettingValue("themes.board", name);
    };
    const setColour = (which: keyof BoardColours, value: string) =>
        void setSettingValue("themes.boardColours", {
            ...colours(),
            [which]: value,
        });
    const colourField = (label: string, which: keyof BoardColours) => (
        <label class="appearance-colour">
            <input
                type="color"
                value={colours()[which]}
                onInput={(e) => setColour(which, e.currentTarget.value)}
            />
            {label}
        </label>
    );

    return (
        <section class="settings-section">
            <h2 class="title is-4">Appearance</h2>
            <div class="appearance">
                <div class="appearance-choices">
                    {choice("Theme", "themes.ui", "system", UI_THEMES)}
                    <div class="field">
                        <label class="label is-small">Board</label>
                        <div class="select is-small">
                            <select
                                value={getSettingValue(
                                    "themes.board",
                                    "bluish",
                                )}
                                onChange={(e) =>
                                    setBoard(e.currentTarget.value)
                                }
                            >
                                <For each={named(BOARD_THEMES)}>
                                    {(o) => (
                                        <option value={o.value}>
                                            {o.label}
                                        </option>
                                    )}
                                </For>
                            </select>
                        </div>
                    </div>
                    <Show
                        when={getSettingValue("themes.board") === CUSTOM_BOARD}
                    >
                        <div class="field appearance-colours">
                            {colourField("Light squares", "light")}
                            {colourField("Dark squares", "dark")}
                            {colourField("Highlights", "highlight")}
                        </div>
                    </Show>
                    {choice(
                        "Pieces",
                        "themes.pieces",
                        "merida",
                        named(PIECE_THEMES),
                    )}
                </div>
                <div class="appearance-preview">
                    <Chessboard config={() => PREVIEW} />
                </div>
            </div>
        </section>
    );
};

export default Appearance;
