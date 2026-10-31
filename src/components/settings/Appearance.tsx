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
import {
    accentVars,
    CUSTOM_THEME,
    parseThemeFile,
    themeFile,
    themeOf,
    UI_PRESETS,
} from "../../models/uitheme";
import { saveExport } from "../../storage/exports";

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

    // the app's theme (U.4): presets, the user's imported theme, an accent over any of them
    const customTheme = () => getSettingValue("themes.customTheme");
    const accent = () => getSettingValue("themes.accent", "");
    const currentTheme = () =>
        themeOf(getSettingValue("themes.ui", "system"), customTheme());
    /** A preset's board and pieces, when they are not the ones in use (a theme pack) */
    const packToUse = () => {
        const t = currentTheme();
        if (!t?.board || !t.pieces) return undefined;
        const same =
            getSettingValue("themes.board") === t.board &&
            getSettingValue("themes.pieces") === t.pieces;
        return same
            ? undefined
            : {
                  board: boardLabel(t.board),
                  pieces: label(t.pieces),
              };
    };
    const usePack = async () => {
        const t = currentTheme();
        if (!t?.board || !t.pieces) return;
        await setSettingValue("themes.board", t.board);
        await setSettingValue("themes.pieces", t.pieces);
    };

    let themeInput!: HTMLInputElement;
    const importTheme = async (input: HTMLInputElement) => {
        const file = input.files?.[0];
        input.value = ""; // the same file again is a new choice
        if (!file) return;
        const theme = parseThemeFile(await file.text());
        if (typeof theme === "string") return makeErrorToast(theme);
        await setSettingValue("themes.customTheme", theme);
        await setSettingValue("themes.ui", CUSTOM_THEME);
        makeToast(`${theme.label} imported`);
    };
    const exportTheme = async () => {
        // the theme in use, its accent included; light, dark and system as a bare mode
        const ui = getSettingValue("themes.ui", "system");
        const t = currentTheme();
        const mode =
            t?.mode ??
            (ui === "dark" ||
            (ui === "system" &&
                window.matchMedia("(prefers-color-scheme: dark)").matches)
                ? "dark"
                : "light");
        const vars = {
            ...(t?.vars ?? {}),
            ...(accent() ? accentVars(accent()) : {}),
        };
        const name = t?.label ?? "My theme";
        try {
            const saved = await saveExport(
                new TextEncoder().encode(
                    themeFile({ label: name, mode, vars }),
                ),
                "json",
                `${name}.json`,
            );
            if (saved) makeToast(`Saved ${saved}`);
        } catch (err) {
            makeErrorToast(String(err));
        }
    };

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
    /** "texture:wood" -> "Wood" */
    const boardLabel = (b: string) =>
        label(
            b.startsWith(TEXTURE_PREFIX) ? b.slice(TEXTURE_PREFIX.length) : b,
        );
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
                    <div class="field">
                        <label class="label is-small">Theme</label>
                        <div class="select is-small">
                            <select
                                value={getSettingValue("themes.ui", "system")}
                                onChange={(e) =>
                                    void setSettingValue(
                                        "themes.ui",
                                        e.currentTarget.value,
                                    )
                                }
                            >
                                <For each={UI_THEMES}>
                                    {(o) => (
                                        <option value={o.value}>
                                            {o.label}
                                        </option>
                                    )}
                                </For>
                                <optgroup label="Themes">
                                    <For each={Object.entries(UI_PRESETS)}>
                                        {([name, t]) => (
                                            <option value={name}>
                                                {t.label}
                                            </option>
                                        )}
                                    </For>
                                    <Show when={customTheme()}>
                                        {(t) => (
                                            <option value={CUSTOM_THEME}>
                                                {t().label}
                                            </option>
                                        )}
                                    </Show>
                                </optgroup>
                            </select>
                        </div>
                    </div>
                    <Show when={packToUse()}>
                        {(pack) => (
                            <Button class="is-small" onClick={usePack}>
                                Use its board ({pack().board}) and pieces (
                                {pack().pieces}) too
                            </Button>
                        )}
                    </Show>
                    <div class="field">
                        <label class="label is-small">Accent</label>
                        <div class="appearance-highlight">
                            <div class="select is-small">
                                <select
                                    value={accent() ? "own" : "theme"}
                                    onChange={(e) =>
                                        void setSettingValue(
                                            "themes.accent",
                                            e.currentTarget.value === "own"
                                                ? "#2e8b57"
                                                : "",
                                        )
                                    }
                                >
                                    <option value="theme">
                                        The theme's own
                                    </option>
                                    <option value="own">My colour</option>
                                </select>
                            </div>
                            <Show when={accent()}>
                                <input
                                    type="color"
                                    title="Buttons, selections and the other accents"
                                    value={accent()}
                                    onInput={(e) =>
                                        void setSettingValue(
                                            "themes.accent",
                                            e.currentTarget.value,
                                        )
                                    }
                                />
                            </Show>
                        </div>
                    </div>
                    <div class="buttons appearance-theme-files">
                        <Button
                            class="is-small"
                            onClick={() => themeInput.click()}
                        >
                            Import a theme…
                        </Button>
                        <Button class="is-small" onClick={exportTheme}>
                            Export this theme…
                        </Button>
                        <input
                            ref={themeInput}
                            type="file"
                            accept=".json,application/json"
                            hidden
                            onChange={(e) => importTheme(e.currentTarget)}
                        />
                    </div>
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
                The licences of these sets do not let Plybook ship them:
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
