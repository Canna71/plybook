import { createEffect } from "solid-js";
import { getSettingValue } from "../models/settings";
import { CSSLoader } from "./CssLoader";
import {
    BOARD_PRESETS,
    BoardColours,
    boardCss,
    CUSTOM_BOARD,
    highlightCss,
    textureOf,
    validColour,
} from "../models/boardtheme";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appConfigDir, join } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { installedPiecesCss } from "../storage/pieces";
import { themeCss, themeOf } from "../models/uitheme";

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
        const highlight = getSettingValue("themes.highlight", "");
        loadBoardStyle(boardTheme!, colours, highlight);
    });
    // the app's theme: Bulma and the tokens read data-theme on <html> (none follows the
    // system); a preset or custom theme (U.4) sets its mode and its variables, an accent
    // colour goes over any of them
    createEffect(() => {
        const ui = getSettingValue("themes.ui", "system");
        const theme = themeOf(ui, getSettingValue("themes.customTheme"));
        const accent = getSettingValue("themes.accent", "");
        const mode =
            theme?.mode ?? (ui === "light" || ui === "dark" ? ui : undefined);
        if (mode) document.documentElement.dataset.theme = mode;
        else delete document.documentElement.dataset.theme;
        const css = themeCss(mode, theme?.vars ?? {}, accent || undefined);
        // an injected <style>, which unloadCSS (for links) does not remove
        if (css) cssLoader.injectCSS(css, "ui-theme");
        else document.getElementById("ui-theme")?.remove();
    });
    // text sizes (F.5): the app's through the root font size (Bulma and the tokens are in
    // rem), the Moves list's and comments' as scales its styles multiply by
    createEffect(() => {
        const size = getSettingValue("themes.textSize");
        const root = document.documentElement;
        root.style.fontSize = size && size.app !== 100 ? `${size.app}%` : "";
        root.style.setProperty(
            "--rc-moves-scale",
            String((size?.moves ?? 100) / 100),
        );
        root.style.setProperty(
            "--rc-comments-scale",
            String((size?.comments ?? 100) / 100),
        );
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
    let css = buildinPiecesThemes[piecesTheme];
    if (css === undefined) {
        // a set the user installed (pieces.rs), or an older custom set in the config folder;
        // one no longer there (removed, or dropped from the app and not downloaded yet) falls
        // back to the default set rather than leaving the board without pieces
        css = await installedPiecesCss(piecesTheme)
            .catch(() => loadStyle(`Themes/pieces/${piecesTheme}/pieces.css`))
            .then((text) => (text.includes("piece.") ? text : undefined))
            .catch(() => undefined)
            .then((text) => text ?? buildinPiecesThemes[DEFAULT_PIECES]);
    }
    cssLoader.injectCSS(css, "pieces-theme");
}

/** The set used when the chosen one cannot be loaded */
const DEFAULT_PIECES = "merida";

/** Loads the chosen set again: after it was installed or removed */
export const reloadPieces = () =>
    loadPiecesStyle(getSettingValue("themes.pieces", DEFAULT_PIECES)!);

async function loadBoardStyle(
    boardTheme: string,
    colours: Partial<BoardColours> | undefined,
    /** The user's highlight colour over the board's own ("" none) */
    highlight: string | undefined,
) {
    if (!boardTheme) return;
    cssLoader.unloadCSS("board-theme");
    let css = "";
    const texture = textureOf(boardTheme);
    if (texture) {
        css = boardCss(texture, texture.file);
    } else if (boardTheme === CUSTOM_BOARD) {
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
    // later rules of the same weight win: the user's highlight over any board's
    if (highlight && validColour(highlight, "")) css += highlightCss(highlight);
    cssLoader.injectCSS(css, "board-theme");
}

const cachedTheme = await getCurrentWindow().theme();

export function getTheme(): "light" | "dark" {
    return cachedTheme || "dark";
}
