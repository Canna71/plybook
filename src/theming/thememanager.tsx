import { createEffect } from "solid-js";
import { getSettingValue } from "../models/settings";
import { CSSLoader } from "./CssLoader";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appConfigDir, join } from "@tauri-apps/api/path";
const cssLoader = new CSSLoader();

import alfarishy from "/src/assets/styles/pieces/alfarishy/pieces.css?inline";
import alpha from "/src/assets/styles/pieces/alpha/pieces.css?inline";
import cardinal from "/src/assets/styles/pieces/cardinal/pieces.css?inline";
import cases from "/src/assets/styles/pieces/cases/pieces.css?inline";
import cburnett from "/src/assets/styles/pieces/cburnett/pieces.css?inline";
import fresca from "/src/assets/styles/pieces/fresca/pieces.css?inline";
import icon54 from "/src/assets/styles/pieces/icon54/pieces.css?inline";
import merida from "/src/assets/styles/pieces/merida/pieces.css?inline";
import motif from "/src/assets/styles/pieces/motif/pieces.css?inline";
import pirat from "/src/assets/styles/pieces/pirat/pieces.css?inline";
import regular from "/src/assets/styles/pieces/regular/pieces.css?inline";
import richaca from "/src/assets/styles/pieces/riohacha/pieces.css?inline";
import smart from "/src/assets/styles/pieces/smart/pieces.css?inline";
import staunty from "/src/assets/styles/pieces/staunty/pieces.css?inline";
import tatiana from "/src/assets/styles/pieces/tatiana/pieces.css?inline";
import traveller from "/src/assets/styles/pieces/traveller/pieces.css?inline";
import trendy from "/src/assets/styles/pieces/trendy/pieces.css?inline";
import trendy_ink from "/src/assets/styles/pieces/trendy_ink/pieces.css?inline";

const buildinPiecesThemes = {
    alfarishy,
    alpha,
    cardinal,
    cases,
    cburnett,
    fresca,
    icon54,
    merida,
    motif,
    pirat,
    regular,
    richaca,
    smart,
    staunty,
    tatiana,
    traveller,
    trendy,
    trendy_ink,
} as Record<string, string>;

import brown from "/src/assets/styles/boards/brown.css?inline";
import bluish from "/src/assets/styles/boards/bluish.css?inline";

const boardBuiltinStyles = {
    bluish: bluish,
    brown: brown,
} as Record<string, string>;

export function useThemes() {
    createEffect(() => {
        const piecesTheme = getSettingValue<string>("themes.pieces", "merida");
        loadPiecesStyle(piecesTheme!);
        const boardTheme = getSettingValue<string>("themes.board", "bluish");
        loadBoardStyle(boardTheme!);
    });
}

async function  loadStyle(path: string) {
    const fullPath = await join(
        await appConfigDir(),
        path,
    );
    const url = convertFileSrc(fullPath);
    const css = await fetch(url).then((res) => res.text());
    return css;
}

async function loadPiecesStyle(piecesTheme: string) {
   
    if (!piecesTheme) return;
    cssLoader.unloadCSS("pieces-theme");
    let css = "";
    if (piecesTheme in buildinPiecesThemes) {
        css = buildinPiecesThemes[piecesTheme];
    } else {
        css = await loadStyle(`Themes/pieces/${piecesTheme}/pieces.css`);
    }
    cssLoader.injectCSS(css, "pieces-theme");
}

async function loadBoardStyle(boardTheme: string) {
    if (!boardTheme) return;
    cssLoader.unloadCSS("board-theme");
    let css = "";
    if (boardTheme in boardBuiltinStyles) {
        css = boardBuiltinStyles[boardTheme] as string;
    } else {
        css = await loadStyle(`Themes/boards/${boardTheme}.css`);
    }
    cssLoader.injectCSS(css, "board-theme");
}
