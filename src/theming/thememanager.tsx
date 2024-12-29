import { createEffect } from "solid-js";
import { getSettingValue } from "../models/settings";
import { CSSLoader } from "./CssLoader";
const cssLoader = new CSSLoader();

const buildinPiecesThemes = {
    "alfarishy": () => import("/src/assets/styles/pieces/alfarishy/pieces.css"),
    "alpha": () => import("/src/assets/styles/pieces/alpha/pieces.css"),
    "cardinal": () => import("/src/assets/styles/pieces/cardinal/pieces.css"),
    "cases": () => import("/src/assets/styles/pieces/cases/pieces.css"),
    "cburnett": () => import("/src/assets/styles/pieces/cburnett/pieces.css"),
    "fresca": () => import("/src/assets/styles/pieces/fresca/pieces.css"),
    "icon54": () => import("/src/assets/styles/pieces/icon54/pieces.css"),
    "merida": () => import("/src/assets/styles/pieces/merida/pieces.css"),
    "motif": () => import("/src/assets/styles/pieces/motif/pieces.css"),
    "pirat" : () => import("/src/assets/styles/pieces/pirat/pieces.css"),
    "regular": () => import("/src/assets/styles/pieces/regular/pieces.css"),
    "richaca": () => import("/src/assets/styles/pieces/riohacha/pieces.css"),
    "smart": () => import("/src/assets/styles/pieces/smart/pieces.css"),
    "staunty": () => import("/src/assets/styles/pieces/staunty/pieces.css"),
    "tatiana": () => import("/src/assets/styles/pieces/tatiana/pieces.css"),
    "traveller": () => import("/src/assets/styles/pieces/traveller/pieces.css"),
    "trendy": () => import("/src/assets/styles/pieces/trendy/pieces.css"),
    "trendy_ink": () => import("/src/assets/styles/pieces/trendy_ink/pieces.css")
} as Record<string, () => Promise<typeof import("*.css")>>;


const boardBuiltinStyles  = {
    bluish: () => import("/src/assets/styles/boards/bluish.css"),
    brown: () => import("/src/assets/styles/boards/brown.css")
} as Record<string, () => Promise<typeof import("*.css")>>;

export function useThemes() {
    createEffect(async () => {
        
        await loadPiecesStyle();
        await loadBoardStyle();
    });
}

async function loadPiecesStyle() {
    console.log("loading pieces style");
    const piecesTheme = await getSettingValue<string>(
        "themes.pieces",
        "merida",
    );

    console.log("piecesTheme", piecesTheme);

    if (!piecesTheme) return;
    cssLoader.unloadCSS("pieces-theme");

    if (piecesTheme in buildinPiecesThemes) {
        console.log("loading builtin pieces theme", piecesTheme);
        const css = await buildinPiecesThemes[piecesTheme]();
        console.log("loaded builtin pieces theme", piecesTheme, css);
    } else {
        // TODOL load from resources folder
        cssLoader.loadCSS(
            `/src/assets/styles/pieces/${piecesTheme}/pieces.css`,
            { id: "pieces-theme" },
        );
    }
}

async function loadBoardStyle() {
    const boardTheme = await getSettingValue<string>("themes.board", "bluish");
    if (!boardTheme) return;
    console.log("boardTheme", boardTheme);
    cssLoader.unloadCSS("board-theme");

    if (boardTheme in boardBuiltinStyles) {
        console.log("loading builtin board theme", boardTheme, boardBuiltinStyles[boardTheme]);
        const css = await boardBuiltinStyles[boardTheme]?.();
        console.log("css", css);
    } else {
        // TODOL load from resources folder
        cssLoader.loadCSS(`/src/assets/styles/boards/${boardTheme}.css`, {
            id: "board-theme",
        });
    }
}
