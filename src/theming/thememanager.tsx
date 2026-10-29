import { createEffect } from "solid-js";
import { getSettingValue } from "../models/settings";
import { CSSLoader } from "./CssLoader";
import {
    BOARD_PRESETS,
    BoardColours,
    boardCss,
    CUSTOM_BOARD,
} from "../models/boardtheme";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appConfigDir, join } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";

const cssLoader = new CSSLoader();

// every piece set in src/assets/styles/pieces, by its folder's name (their sources and licences
// are in that folder's README.md)
const pieceSheets = import.meta.glob<string>(
    "/src/assets/styles/pieces/*/pieces.css",
    { query: "?inline", import: "default", eager: true },
);
const buildinPiecesThemes: Record<string, string> = Object.fromEntries(
    Object.entries(pieceSheets).map(([path, css]) => [
        path.split("/").at(-2)!,
        css,
    ]),
);
/** Settings written before the set kept its folder's name */
const PIECE_ALIASES: Record<string, string> = { richaca: "riohacha" };

import brown from "/src/assets/styles/boards/brown.css?inline";
import bluish from "/src/assets/styles/boards/bluish.css?inline";

const boardBuiltinStyles = {
    bluish: bluish,
    brown: brown,
} as Record<string, string>;

/**
 * The built-in board and piece themes, by name (Settings → Appearance): the boards of the
 * original stylesheets, the colour presets (U.3) and the user's own colours.
 */
export const BOARD_THEMES = [
    ...Object.keys(boardBuiltinStyles),
    ...Object.keys(BOARD_PRESETS).filter((n) => !(n in boardBuiltinStyles)),
    CUSTOM_BOARD,
];
export const PIECE_THEMES = Object.keys(buildinPiecesThemes).sort();

export function useThemes() {
    createEffect(() => {
        const piecesTheme = getSettingValue("themes.pieces", "merida");
        loadPiecesStyle(piecesTheme!);
        const boardTheme = getSettingValue("themes.board", "bluish");
        // read here, so picking a colour redraws the custom board at once
        const colours = getSettingValue("themes.boardColours");
        loadBoardStyle(boardTheme!, colours);
    });
    // light/dark UI: Bulma and the tokens read data-theme on <html>; none follows the system
    createEffect(() => {
        const ui = getSettingValue("themes.ui", "system");
        if (ui === "light" || ui === "dark")
            document.documentElement.dataset.theme = ui;
        else delete document.documentElement.dataset.theme;
    });
}

async function loadStyle(path: string) {
    const fullPath = await join(await appConfigDir(), path);
    const url = convertFileSrc(fullPath);
    const css = await fetch(url).then((res) => res.text());
    return css;
}

async function loadPiecesStyle(setting: string) {
    if (!setting) return;
    const piecesTheme = PIECE_ALIASES[setting] ?? setting;
    cssLoader.unloadCSS("pieces-theme");
    let css = "";
    if (piecesTheme in buildinPiecesThemes) {
        css = buildinPiecesThemes[piecesTheme];
    } else {
        css = await loadStyle(`Themes/pieces/${piecesTheme}/pieces.css`);
    }
    cssLoader.injectCSS(css, "pieces-theme");
}

async function loadBoardStyle(
    boardTheme: string,
    colours: Partial<BoardColours> | undefined,
) {
    if (!boardTheme) return;
    cssLoader.unloadCSS("board-theme");
    let css = "";
    if (boardTheme === CUSTOM_BOARD) {
        css = boardCss(colours ?? {});
    } else if (
        boardTheme in BOARD_PRESETS &&
        !(boardTheme in boardBuiltinStyles)
    ) {
        css = boardCss(BOARD_PRESETS[boardTheme]);
    } else if (boardTheme in boardBuiltinStyles) {
        css = boardBuiltinStyles[boardTheme] as string;
    } else {
        css = await loadStyle(`Themes/boards/${boardTheme}.css`);
    }
    cssLoader.injectCSS(css, "board-theme");
}

const cachedTheme = await getCurrentWindow().theme();

export function getTheme(): "light" | "dark" {
    return cachedTheme || "dark";
}
