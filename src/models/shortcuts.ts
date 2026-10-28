// Keyboard shortcuts of the game editor (analysis, notes, studies): which key does what, and
// the list the help shows. Kept free of the DOM so it can be tested.

export type ShortcutAction =
    | "previous"
    | "next"
    | "start"
    | "end"
    | "previousVariation"
    | "nextVariation"
    | "flip"
    | "engine"
    | "threat"
    | "bestMove"
    | "pen"
    | "help";

export type Shortcut = {
    action: ShortcutAction;
    /** As shown in the help */
    keys: string[];
    description: string;
    /** Moves through the game: off while playing the engine or solving a puzzle */
    navigates?: boolean;
};

export const SHORTCUTS: Shortcut[] = [
    {
        action: "previous",
        keys: ["←", "K"],
        description: "Previous move",
        navigates: true,
    },
    {
        action: "next",
        keys: ["→", "J"],
        description: "Next move",
        navigates: true,
    },
    {
        action: "start",
        keys: ["↑", "Home"],
        description: "Start of the game",
        navigates: true,
    },
    {
        action: "end",
        keys: ["↓", "End"],
        description: "End of the line",
        navigates: true,
    },
    {
        action: "previousVariation",
        keys: ["Shift+↑"],
        description: "Previous variation at this move",
        navigates: true,
    },
    {
        action: "nextVariation",
        keys: ["Shift+↓"],
        description: "Next variation at this move",
        navigates: true,
    },
    { action: "flip", keys: ["F"], description: "Flip the board" },
    { action: "engine", keys: ["L"], description: "Engine analysis on/off" },
    {
        action: "threat",
        keys: ["X"],
        description: "Show the threat (the other side's best move)",
    },
    {
        action: "bestMove",
        keys: ["Space"],
        description: "Play the engine's best move",
        navigates: true,
    },
    {
        action: "pen",
        keys: ["D"],
        description:
            "Pen: draw arrows and circles with a plain click or drag (Shift + drag always draws)",
    },
    { action: "help", keys: ["?"], description: "Show these shortcuts" },
];

/** What matters of a key event. */
export type KeyPress = {
    key: string;
    shiftKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    /** Tag name of the element with focus ("INPUT", ...) */
    targetTag?: string;
    /** The focused element is editable (contenteditable) */
    targetEditable?: boolean;
};

const BY_KEY: Record<string, ShortcutAction> = {
    ArrowLeft: "previous",
    k: "previous",
    ArrowRight: "next",
    j: "next",
    ArrowUp: "start",
    Home: "start",
    ArrowDown: "end",
    End: "end",
    f: "flip",
    l: "engine",
    x: "threat",
    " ": "bestMove",
    d: "pen",
    "?": "help",
};

/**
 * The editor's action for a key press, or undefined: keys typed into a field, and keys with
 * Cmd/Ctrl/Alt (the system's and the app's own shortcuts), are left alone.
 */
export function shortcutFor(press: KeyPress): ShortcutAction | undefined {
    if (press.ctrlKey || press.metaKey || press.altKey) return undefined;
    const tag = press.targetTag?.toUpperCase();
    if (
        press.targetEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
    )
        return undefined;
    // Space presses a focused button
    if (press.key === " " && tag === "BUTTON") return undefined;
    if (press.shiftKey && press.key === "ArrowUp") return "previousVariation";
    if (press.shiftKey && press.key === "ArrowDown") return "nextVariation";
    const key = press.key.length === 1 ? press.key.toLowerCase() : press.key;
    // "?" needs Shift on most layouts; other letters only without it
    if (press.shiftKey && key !== "?") return undefined;
    return BY_KEY[key];
}
