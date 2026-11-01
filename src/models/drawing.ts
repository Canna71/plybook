// Drawing arrows and circles on the board without the right button (U.2): a touchpad's
// right-click takes two fingers. Pure, for tests; the board side is common/chessboard.tsx.

/** The four colours of arrows and circles, as in PGN's [%cal] / [%csl] and on Lichess */
export const PEN_COLOURS = ["green", "red", "blue", "yellow"] as const;
export type PenColour = (typeof PEN_COLOURS)[number];

export const isPenColour = (c: string | undefined): c is PenColour =>
    (PEN_COLOURS as readonly string[]).includes(c ?? "");

/** What matters of a press for its colour */
export type PressKeys = {
    shiftKey: boolean;
    altKey: boolean;
    metaKey: boolean;
};

/**
 * The colour of a Shift + left press (or click), which draws instead of moving: Shift green,
 * Shift+Option blue, Shift+Cmd red, Shift+Option+Cmd yellow. Undefined without Shift: a plain
 * press moves pieces.
 */
export function shiftColour(keys: PressKeys): PenColour | undefined {
    if (!keys.shiftKey) return undefined;
    if (keys.altKey && keys.metaKey) return "yellow";
    if (keys.metaKey) return "red";
    if (keys.altKey) return "blue";
    return "green";
}
