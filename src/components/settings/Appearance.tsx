import { Component, For } from "solid-js";
import { Config } from "chessground/config";
import { Chessboard } from "../common/chessboard";
import { getSettingValue, setSettingValue } from "../../models/settings";
import { BOARD_THEMES, PIECE_THEMES } from "../../theming/thememanager";

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
            label: (n.charAt(0).toUpperCase() + n.slice(1)).replace(/_/g, " "),
        }));

    return (
        <section class="settings-section">
            <h2 class="title is-4">Appearance</h2>
            <div class="appearance">
                <div class="appearance-choices">
                    {choice("Theme", "themes.ui", "system", UI_THEMES)}
                    {choice(
                        "Board",
                        "themes.board",
                        "bluish",
                        named(BOARD_THEMES),
                    )}
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
