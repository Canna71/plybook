import { createEffect } from "solid-js";
import { getSettingValue } from "../models/settings";
import { CSSLoader } from "./CssLoader";
const cssLoader = new CSSLoader();

const buildinPiecesThemes = [
    "alfarishy",
    "alpha",
    "cardinal",
    "cases",
    "cburnett",
    "fresca",
    "icon54",
    "merida",
    "motif",
    "pirat",
    "regular",
    "richaca",
    "smart",
    "staunty",
    "tatiana",
    "traveller",
    "trendy",
    "trendy_ink",
];

const alfarishy = import("/src/assets/styles/pieces/alfarishy/pieces.css");
const alpha = import("/src/assets/styles/pieces/alpha/pieces.css");
const cardinal = import("/src/assets/styles/pieces/cardinal/pieces.css");
const cases = import("/src/assets/styles/pieces/cases/pieces.css");
const cburnett = import("/src/assets/styles/pieces/cburnett/pieces.css");
const fresca = import("/src/assets/styles/pieces/fresca/pieces.css");
const icon54 = import("/src/assets/styles/pieces/icon54/pieces.css");
const merida = import("/src/assets/styles/pieces/merida/pieces.css");
const motif = import("/src/assets/styles/pieces/motif/pieces.css");
const pirat = import("/src/assets/styles/pieces/pirat/pieces.css");
const regular = import("/src/assets/styles/pieces/regular/pieces.css");
const richacha = import("/src/assets/styles/pieces/riohacha/pieces.css");
const smart = import("/src/assets/styles/pieces/smart/pieces.css");
const staunty = import("/src/assets/styles/pieces/staunty/pieces.css");
const tatiana = import("/src/assets/styles/pieces/tatiana/pieces.css");
const traveller = import("/src/assets/styles/pieces/traveller/pieces.css");
const trendy = import("/src/assets/styles/pieces/trendy/pieces.css");
const trendy_ink = import("/src/assets/styles/pieces/trendy_ink/pieces.css");


const buildinBoardThemes = ["bluish", "brown"];

const bluish = import("/src/assets/styles/boards/bluish.css");
const brown = import("/src/assets/styles/boards/brown.css");

export function useThemes() {
    createEffect(async () => {
        // TODOL load from resources folder
        await loadPiecesStyle();
        await loadBoardStyle();
    });
}

async function loadBoardStyle() {
    const piecesTheme = await getSettingValue<string>(
        "themes.pieces",
        "merida",
    );
    if (!piecesTheme) return;
    cssLoader.unloadCSS("pieces-theme");

    if (!buildinPiecesThemes.includes(piecesTheme)) {
        import(`/src/assets/styles/pieces/${piecesTheme}/pieces.css`);
    } else {
        cssLoader.loadCSS(
            `/src/assets/styles/pieces/${piecesTheme}/pieces.css`,
            { id: "pieces-theme" },
        );
    }
}

async function loadPiecesStyle() {
    const boardTheme = await getSettingValue("themes.board", "bluish");
    if (!boardTheme) return;
    console.log("boardTheme", boardTheme);
    cssLoader.unloadCSS("board-theme");

    if (!buildinBoardThemes.includes(boardTheme)) {
        import(`/src/assets/styles/boards/${boardTheme}.css`);
    } else {
        cssLoader.loadCSS(`/src/assets/styles/boards/${boardTheme}.css`, {
            id: "board-theme",
        });
    }
}
