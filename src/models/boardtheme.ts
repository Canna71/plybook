// Board colours (U.3): a board drawn by the app from two square colours and a highlight colour,
// as presets or the user's own. No image is involved, so nothing to license. Pure: the CSS is
// injected by theming/thememanager.tsx.

/** Colours as "#rrggbb" */
export type BoardColours = {
    light: string;
    dark: string;
    /** The last move, the selected square and the move dots */
    highlight: string;
};

/** Ready-made boards, by name (the names are shown capitalized, "_" as a space) */
export const BOARD_PRESETS: Record<string, BoardColours> = {
    classic: { light: "#f0d9b5", dark: "#b58863", highlight: "#9bc700" },
    blue: { light: "#dee3e6", dark: "#8ca2ad", highlight: "#0077cc" },
    green: { light: "#eeeed2", dark: "#769656", highlight: "#bbcb2b" },
    olive: { light: "#e8e4c9", dark: "#9a9d6a", highlight: "#d1a700" },
    grey: { light: "#dcdcdc", dark: "#a0a0a0", highlight: "#4a90d9" },
    purple: { light: "#e9e3f3", dark: "#9b84bd", highlight: "#e0b400" },
    ice: { light: "#e8f1f8", dark: "#a7c2d8", highlight: "#2a9d8f" },
    coral: { light: "#f6e6d8", dark: "#d98a6c", highlight: "#4c9a2a" },
    sand: { light: "#f3ead7", dark: "#d2b48c", highlight: "#6aa84f" },
    night: { light: "#8a9bad", dark: "#4b5b6b", highlight: "#e0c341" },
    high_contrast: { light: "#ffffff", dark: "#5a6e7f", highlight: "#ff8c00" },
};

/** The name of the board made from the user's colours */
export const CUSTOM_BOARD = "custom";

const HEX = /^#[0-9a-f]{6}$/i;

/** A colour as "#rrggbb", or the fallback: colours come from the settings file */
export const validColour = (c: unknown, fallback: string) =>
    typeof c === "string" && HEX.test(c) ? c.toLowerCase() : fallback;

/** "rgba(r, g, b, a)" from "#rrggbb" */
export function rgba(hex: string, alpha: number): string {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** The 8×8 squares as an SVG: a8 (top left) is light */
export function boardSvg(light: string, dark: string): string {
    let squares = "";
    for (let row = 0; row < 8; row++)
        for (let col = 0; col < 8; col++)
            if ((row + col) % 2 === 1) squares += `M${col} ${row}h1v1h-1z`;
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 8" shape-rendering="crispEdges">` +
        `<rect width="8" height="8" fill="${light}"/><path d="${squares}" fill="${dark}"/></svg>`
    );
}

/**
 * The CSS of a board in these colours, for chessground: the squares, the highlights (last move,
 * selected square, move dots) and the coordinates (each in the other square colour). Invalid
 * colours fall back to the classic board's.
 */
export function boardCss(colours: Partial<BoardColours>): string {
    const base = BOARD_PRESETS.classic;
    const light = validColour(colours.light, base.light);
    const dark = validColour(colours.dark, base.dark);
    const highlight = validColour(colours.highlight, base.highlight);
    const svg = encodeURIComponent(boardSvg(light, dark));
    return `
cg-board {
    background-color: ${light};
    background-image: url("data:image/svg+xml;utf8,${svg}");
}
cg-board square.move-dest {
    background: radial-gradient(${rgba(highlight, 0.5)} 22%, transparent 0);
}
cg-board square.oc.move-dest {
    background: radial-gradient(transparent 0%, transparent 80%, ${rgba(highlight, 0.4)} 80%);
}
cg-board square.move-dest:hover {
    background: ${rgba(highlight, 0.3)};
}
cg-board square.premove-dest {
    background: radial-gradient(${rgba(dark, 0.6)} 22%, transparent 0);
}
cg-board square.last-move {
    background-color: ${rgba(highlight, 0.41)};
}
cg-board square.selected {
    background-color: ${rgba(highlight, 0.55)};
}
cg-board square.current-premove {
    background-color: ${rgba(dark, 0.5)};
}
cg-board square.check {
    background: radial-gradient(ellipse at center, rgba(255, 0, 0, 1) 0%, rgba(231, 0, 0, 1) 25%,
        rgba(169, 0, 0, 0) 89%, rgba(158, 0, 0, 0) 100%);
}
.cg-wrap coords:nth-child(odd) coord:nth-child(even),
.cg-wrap coords.squares:nth-child(even) coord:nth-child(odd),
.cg-wrap.orientation-black coords.files:nth-child(even) coord:nth-child(odd),
.cg-wrap coords.files:nth-child(even) coord:nth-child(even) {
    color: ${dark};
}
.cg-wrap coords:nth-child(odd) coord:nth-child(odd),
.cg-wrap coords.squares:nth-child(even) coord:nth-child(even),
.cg-wrap.orientation-black coords.files:nth-child(even) coord:nth-child(even),
.cg-wrap coords.files:nth-child(even) coord:nth-child(odd) {
    color: ${light};
}
`;
}
