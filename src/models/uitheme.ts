// App themes (U.4): presets beyond light and dark, an accent colour over any theme, and custom
// themes from a small file. A theme is a light or dark base and a few of Bulma's variables and
// our --rc-* tokens (src/styles/tokens.scss); a preset can suggest a board and pieces too
// (a "theme pack"). Pure: the CSS is injected by theming/thememanager.tsx.

export type ThemeMode = "light" | "dark";

export type UiTheme = {
    label: string;
    mode: ThemeMode;
    /** CSS custom properties, "--bulma-…" or "--rc-…" */
    vars: Record<string, string>;
    /** The board and pieces that go with it (settings names), offered, never forced */
    board?: string;
    pieces?: string;
};

/** The theme made from a file the user imported */
export const CUSTOM_THEME = "custom";

/** Light and dark lightness of the scheme, Bulma's names */
const scheme = (main: number, bis: number, ter: number) => ({
    "--bulma-scheme-main-l": `${main}%`,
    "--bulma-scheme-main-bis-l": `${bis}%`,
    "--bulma-scheme-main-ter-l": `${ter}%`,
});

/** The presets, by settings name */
export const UI_PRESETS: Record<string, UiTheme> = {
    paper: {
        label: "Paper",
        mode: "light",
        vars: {
            "--bulma-scheme-h": "40",
            "--bulma-scheme-s": "30%",
            ...scheme(97, 94, 91),
            "--bulma-primary-h": "25",
            "--bulma-primary-s": "55%",
            "--bulma-primary-l": "36%",
        },
        board: "classic",
        pieces: "merida",
    },
    forest: {
        label: "Forest",
        mode: "light",
        vars: {
            "--bulma-scheme-h": "120",
            "--bulma-scheme-s": "12%",
            ...scheme(98, 95, 92),
            "--bulma-primary-h": "140",
            "--bulma-primary-s": "45%",
            "--bulma-primary-l": "30%",
        },
        board: "green",
        pieces: "cburnett",
    },
    club_dark: {
        label: "Club dark",
        mode: "dark",
        vars: {
            "--bulma-scheme-h": "40",
            "--bulma-scheme-s": "8%",
            ...scheme(8, 10, 13),
            "--bulma-primary-h": "88",
            "--bulma-primary-s": "62%",
            "--bulma-primary-l": "37%",
            "--bulma-link-h": "209",
            "--bulma-link-s": "79%",
            "--bulma-link-l": "56%",
        },
        board: "texture:wood",
        pieces: "cburnett",
    },
    midnight: {
        label: "Midnight",
        mode: "dark",
        vars: {
            "--bulma-scheme-h": "222",
            "--bulma-scheme-s": "30%",
            ...scheme(10, 12, 15),
            "--bulma-primary-h": "199",
            "--bulma-primary-s": "80%",
            "--bulma-primary-l": "40%",
        },
        board: "texture:blue3",
        pieces: "chessnut",
    },
    high_contrast: {
        label: "High contrast (light)",
        mode: "light",
        vars: {
            "--bulma-scheme-s": "0%",
            ...scheme(100, 100, 96),
            "--bulma-text-l": "8%",
            "--bulma-text-strong-l": "0%",
            "--bulma-text-weak-l": "28%",
            "--bulma-border-l": "35%",
            "--bulma-border-weak-l": "55%",
            "--bulma-primary-l": "24%",
        },
        board: "high_contrast",
        pieces: "cburnett",
    },
    high_contrast_dark: {
        label: "High contrast (dark)",
        mode: "dark",
        vars: {
            "--bulma-scheme-s": "0%",
            ...scheme(0, 4, 8),
            "--bulma-text-l": "92%",
            "--bulma-text-strong-l": "100%",
            "--bulma-text-weak-l": "75%",
            "--bulma-border-l": "65%",
            "--bulma-border-weak-l": "45%",
            "--bulma-primary-l": "45%",
        },
        board: "high_contrast",
        pieces: "cburnett",
    },
};

const NAME = /^--(rc|bulma)-[a-z0-9-]{1,60}$/;
// numbers, %, deg, colours, hsl()/rgb(): nothing that ends a rule or loads anything
const VALUE = /^[#a-zA-Z0-9%.,()\s-]{1,80}$/;

/** A variable a theme may set: our tokens or Bulma's, with a plain value */
export const safeVar = (name: string, value: unknown): value is string =>
    NAME.test(name) &&
    typeof value === "string" &&
    VALUE.test(value) &&
    !/url|expression/i.test(value);

/** "#rrggbb" -> [h 0-360, s %, l %] */
export function hexToHsl(hex: string): [number, number, number] | undefined {
    if (!/^#[0-9a-f]{6}$/i.test(hex)) return undefined;
    const n = parseInt(hex.slice(1), 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(
        (v) => v / 255,
    );
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    const d = max - min;
    if (d === 0) return [0, 0, Math.round(l * 100)];
    const s = d / (1 - Math.abs(2 * l - 1));
    const h =
        max === r
            ? ((g - b) / d + (g < b ? 6 : 0)) * 60
            : max === g
              ? ((b - r) / d + 2) * 60
              : ((r - g) / d + 4) * 60;
    return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}

/** Bulma's primary colour from an accent "#rrggbb", with white or black text on it */
export function accentVars(hex: string): Record<string, string> {
    const hsl = hexToHsl(hex);
    if (!hsl) return {};
    const [h, s, l] = hsl;
    return {
        "--bulma-primary-h": `${h}deg`,
        "--bulma-primary-s": `${s}%`,
        "--bulma-primary-l": `${l}%`,
        // dark text on a light accent, white on a dark one
        "--bulma-primary-invert-l": l > 60 ? "4%" : "100%",
    };
}

/**
 * The CSS of a theme and an accent, for `mode`: under :root[data-theme=…], which wins over
 * Bulma's own light and dark values; without a mode (the system's) under :root, for an
 * accent alone. Variables that are not safe are left out.
 */
export function themeCss(
    mode: ThemeMode | undefined,
    vars: Record<string, string>,
    accent?: string,
): string {
    const all = { ...vars, ...(accent ? accentVars(accent) : {}) };
    const lines = Object.entries(all)
        .filter(([name, value]) => safeVar(name, value))
        .map(([name, value]) => `    ${name}: ${value};`);
    const selector = mode ? `:root[data-theme="${mode}"]` : ":root";
    return lines.length ? `${selector} {\n${lines.join("\n")}\n}\n` : "";
}

/** The theme a setting names: a preset, the custom one, or none (system, light, dark) */
export function themeOf(
    ui: string | undefined,
    custom: UiTheme | undefined,
): UiTheme | undefined {
    if (ui === CUSTOM_THEME) return custom;
    return ui ? UI_PRESETS[ui] : undefined;
}

/** A theme file: what export writes and import reads */
export type ThemeFile = {
    name: string;
    mode: ThemeMode;
    vars: Record<string, string>;
};

/** A theme file's text as a theme, keeping only safe variables; or why it is not one */
export function parseThemeFile(text: string): UiTheme | string {
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        return "Not a theme file (it is not JSON)";
    }
    const file = data as Partial<ThemeFile>;
    if (file?.mode !== "light" && file?.mode !== "dark")
        return 'A theme file needs "mode": "light" or "dark"';
    if (!file.vars || typeof file.vars !== "object")
        return 'A theme file needs "vars": { "--bulma-…": "…" }';
    const vars = Object.fromEntries(
        Object.entries(file.vars).filter(([n, v]) => safeVar(n, v)),
    ) as Record<string, string>;
    if (!Object.keys(vars).length)
        return "No usable variable in the file (names --bulma-… or --rc-…)";
    const label =
        typeof file.name === "string" && file.name.trim()
            ? file.name.trim().slice(0, 40)
            : "My theme";
    return { label, mode: file.mode, vars };
}

/** A theme as a file, to share or edit */
export const themeFile = (theme: UiTheme): string =>
    JSON.stringify(
        { name: theme.label, mode: theme.mode, vars: theme.vars } as ThemeFile,
        null,
        2,
    ) + "\n";
