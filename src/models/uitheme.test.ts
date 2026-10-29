import { describe, expect, it } from "vitest";
import {
    accentVars,
    CUSTOM_THEME,
    hexToHsl,
    parseThemeFile,
    safeVar,
    themeCss,
    themeFile,
    themeOf,
    UI_PRESETS,
} from "./uitheme";

describe("app themes", () => {
    it("writes a theme under its mode, where it wins over Bulma's own", () => {
        const css = themeCss("dark", UI_PRESETS.midnight.vars);
        expect(css.startsWith(':root[data-theme="dark"] {')).toBe(true);
        expect(css).toContain("--bulma-scheme-h: 222;");
        // an accent alone, with the system's mode
        expect(themeCss(undefined, {}, "#ff0000")).toContain(":root {");
        expect(themeCss(undefined, {})).toBe("");
    });

    it("an accent becomes Bulma's primary colour, with readable text on it", () => {
        expect(hexToHsl("#ff0000")).toEqual([0, 100, 50]);
        expect(hexToHsl("#808080")).toEqual([0, 0, 50]);
        expect(hexToHsl("red")).toBeUndefined();
        expect(accentVars("#2e8b57")["--bulma-primary-invert-l"]).toBe("100%");
        expect(accentVars("#f0f0a0")["--bulma-primary-invert-l"]).toBe("4%");
        // the accent goes over the theme's own primary
        const css = themeCss("light", UI_PRESETS.paper.vars, "#ff0000");
        expect(css).toContain("--bulma-primary-h: 0deg;");
        expect(css).not.toContain("--bulma-primary-h: 25;");
    });

    it("lets only our and Bulma's variables through, with plain values", () => {
        expect(safeVar("--bulma-scheme-h", "220")).toBe(true);
        expect(safeVar("--rc-accent", "hsl(10, 20%, 30%)")).toBe(true);
        expect(safeVar("color", "red")).toBe(false);
        expect(safeVar("--rc-x", "red; } body { display: none")).toBe(false);
        expect(safeVar("--rc-x", "url(http://example.com/x.png)")).toBe(false);
        expect(safeVar("--rc-x", 42)).toBe(false);
    });

    it("reads a theme file, keeping only safe variables", () => {
        const theme = parseThemeFile(
            JSON.stringify({
                name: "Night owl",
                mode: "dark",
                vars: {
                    "--bulma-scheme-h": "260",
                    "--rc-bad": "x; } * { color: red",
                    position: "absolute",
                },
            }),
        );
        expect(theme).toEqual({
            label: "Night owl",
            mode: "dark",
            vars: { "--bulma-scheme-h": "260" },
        });
        expect(parseThemeFile("not json")).toMatch(/not JSON/);
        expect(parseThemeFile('{"mode":"blue","vars":{}}')).toMatch(/mode/);
        expect(parseThemeFile('{"mode":"light","vars":{"x":"1"}}')).toMatch(
            /No usable variable/,
        );
    });

    it("writes a file that reads back as the same theme", () => {
        const back = parseThemeFile(themeFile(UI_PRESETS.forest));
        expect(back).toEqual({
            label: "Forest",
            mode: "light",
            vars: UI_PRESETS.forest.vars,
        });
    });

    it("every preset is safe, and names its mode", () => {
        for (const t of Object.values(UI_PRESETS)) {
            expect(["light", "dark"]).toContain(t.mode);
            for (const [n, v] of Object.entries(t.vars))
                expect(safeVar(n, v)).toBe(true);
        }
    });

    it("finds the theme a setting names", () => {
        expect(themeOf("paper", undefined)?.label).toBe("Paper");
        expect(themeOf("dark", undefined)).toBeUndefined();
        const mine = { label: "Mine", mode: "dark" as const, vars: {} };
        expect(themeOf(CUSTOM_THEME, mine)).toBe(mine);
    });
});
