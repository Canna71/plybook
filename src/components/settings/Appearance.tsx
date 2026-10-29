import { Component, createResource, createSignal, For, Show } from "solid-js";
import { Config } from "chessground/config";
import { Chessboard } from "../common/chessboard";
import Button from "../common/Button";
import { makeErrorToast, makeToast } from "../common/Toast";
import { getSettingValue, setSettingValue } from "../../models/settings";
import {
    BOARD_THEMES,
    PIECE_THEMES,
    reloadPieces,
} from "../../theming/thememanager";
import {
    downloadablePieces,
    downloadPieces,
    importPieces,
    listInstalledPieces,
    removePieces,
} from "../../storage/pieces";
import {
    BOARD_PRESETS,
    BOARD_TEXTURES,
    BoardColours,
    CUSTOM_BOARD,
    TEXTURE_PREFIX,
} from "../../models/boardtheme";

const UI_THEMES = [
    { value: "system", label: "Same as the system" },
    { value: "light", label: "Light" },
    { value: "dark", label: "Dark" },
];

const COORDINATES = [
    { value: "edges", label: "Along the edges" },
    { value: "squares", label: "On every square" },
    { value: "off", label: "None" },
];

// a position with every piece, to judge a piece set
const PREVIEW: Config = {
    fen: "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R",
    // coordinates as the settings say (chessboard.tsx), to judge them too
    viewOnly: true,
};

/** Light or dark UI, board colours and piece set; changes apply at once. */
const Appearance: Component = () => {
    const choice = (
        label: string,
        key:
            | "themes.ui"
            | "themes.board"
            | "themes.pieces"
            | "themes.coordinates",
        fallback: string,
        options: { value: string; label: string }[],
    ) => (
        <div class="field">
            <label class="label is-small">{label}</label>
            <div class="select is-small">
                <select
                    // a value not among the options (a piece set no longer there) shows
                    // as the fallback, as the board does
                    value={
                        options.some(
                            (o) => o.value === getSettingValue(key, fallback),
                        )
                            ? getSettingValue(key, fallback)
                            : fallback
                    }
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
                    : (n.charAt(0).toUpperCase() + n.slice(1))
                          .replace(/_/g, " ")
                          // "wood2" -> "Wood 2"
                          .replace(/([a-z])(\d+)$/, "$1 $2"),
        }));

    // a highlight colour over any board (U.3): "" for the board's own
    const ownHighlight = () => getSettingValue("themes.highlight", "");
    const setOwnHighlight = (own: boolean) =>
        void setSettingValue(
            "themes.highlight",
            own ? BOARD_PRESETS.classic.highlight : "",
        );

    // piece sets installed by the user (U.3): imported, or downloaded when not shippable
    const [installed, { refetch }] = createResource(() =>
        listInstalledPieces().catch(() => [] as string[]),
    );
    const [downloadable] = createResource(() =>
        downloadablePieces().catch(() => [] as string[]),
    );
    const [busy, setBusy] = createSignal(false);
    const label = (n: string) => named([n])[0].label;
    const pieceSets = () => [
        ...named(PIECE_THEMES),
        ...named((installed() ?? []).filter((n) => !PIECE_THEMES.includes(n))),
    ];
    const toDownload = () =>
        (downloadable() ?? []).filter((n) => !installed()?.includes(n));
    /** Installs a set, then shows it */
    const install = async (run: () => Promise<string | undefined>) => {
        setBusy(true);
        try {
            const name = await run();
            if (name) {
                await refetch();
                await setSettingValue("themes.pieces", name);
                await reloadPieces();
                makeToast(`${label(name)} installed`);
            }
        } catch (err) {
            makeErrorToast(String(err));
        } finally {
            setBusy(false);
        }
    };
    const download = (name: string) =>
        install(async () => {
            await downloadPieces(name);
            return name;
        });
    const addOwn = () => install(importPieces);
    const remove = async (name: string) => {
        await removePieces(name).catch((err) => makeErrorToast(String(err)));
        await refetch();
        // the set in use gives way to the default one
        if (getSettingValue("themes.pieces") === name)
            await setSettingValue("themes.pieces", "merida");
        await reloadPieces();
    };

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
                                <optgroup label="Colours">
                                    <For each={named(BOARD_THEMES)}>
                                        {(o) => (
                                            <option value={o.value}>
                                                {o.label}
                                            </option>
                                        )}
                                    </For>
                                </optgroup>
                                <optgroup label="Textures (Lichess)">
                                    <For each={Object.keys(BOARD_TEXTURES)}>
                                        {(t) => (
                                            <option value={TEXTURE_PREFIX + t}>
                                                {label(t)}
                                            </option>
                                        )}
                                    </For>
                                </optgroup>
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
                    <Show
                        when={getSettingValue("themes.board") !== CUSTOM_BOARD}
                    >
                        <div class="field">
                            <label class="label is-small">Highlights</label>
                            <div class="appearance-highlight">
                                <div class="select is-small">
                                    <select
                                        value={ownHighlight() ? "own" : "board"}
                                        onChange={(e) =>
                                            setOwnHighlight(
                                                e.currentTarget.value === "own",
                                            )
                                        }
                                    >
                                        <option value="board">
                                            The board's own
                                        </option>
                                        <option value="own">My colour</option>
                                    </select>
                                </div>
                                <Show when={ownHighlight()}>
                                    <input
                                        type="color"
                                        title="Last move, selected square and move dots"
                                        value={ownHighlight()}
                                        onInput={(e) =>
                                            void setSettingValue(
                                                "themes.highlight",
                                                e.currentTarget.value,
                                            )
                                        }
                                    />
                                </Show>
                            </div>
                        </div>
                    </Show>
                    {choice(
                        "Coordinates",
                        "themes.coordinates",
                        "edges",
                        COORDINATES,
                    )}
                    {choice("Pieces", "themes.pieces", "merida", pieceSets())}
                </div>
                <div class="appearance-preview">
                    <Chessboard config={() => PREVIEW} />
                </div>
            </div>

            <h3 class="title is-6 appearance-more">More piece sets</h3>
            <p class="settings-help">
                The licences of these sets do not let ReChess ship them:
                download one and it is fetched for you from
                sharechess.github.io, where they are published with their
                authors' names. Or add your own: a folder of 12 images named wK,
                wQ, wR, wB, wN, wP and bK…bP (SVG or PNG).
            </p>
            <div class="buttons">
                <For each={toDownload()}>
                    {(name) => (
                        <Button
                            class="is-small"
                            disabled={busy()}
                            onClick={() => download(name)}
                        >
                            Download {label(name)}
                        </Button>
                    )}
                </For>
                <Button class="is-small" disabled={busy()} onClick={addOwn}>
                    Add your own set…
                </Button>
            </div>
            <Show when={(installed()?.length ?? 0) > 0}>
                <table class="table is-narrow">
                    <tbody>
                        <For each={installed()}>
                            {(name) => (
                                <tr>
                                    <td>{label(name)}</td>
                                    <td>
                                        <Button
                                            class="is-small is-danger is-outlined"
                                            onClick={() => remove(name)}
                                        >
                                            Remove
                                        </Button>
                                    </td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </Show>
        </section>
    );
};

export default Appearance;
