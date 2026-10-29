import { describe, expect, it } from "vitest";
import {
    BOARD_PRESETS,
    boardCss,
    boardSvg,
    rgba,
    validColour,
} from "./boardtheme";

describe("board colours", () => {
    it("draws the dark squares where they belong: a8 light, b8 dark, h1 light", () => {
        const svg = boardSvg("#ffffff", "#000000");
        // b8 is column 1 of row 0; a8 (0 0) and h1 (7 7) are not in the dark path
        expect(svg).toContain("M1 0h1v1h-1z");
        expect(svg).not.toContain("M0 0h1");
        expect(svg).not.toContain("M7 7h1");
        expect(svg.match(/h1v1h-1z/g)).toHaveLength(32);
    });

    it("makes CSS with the squares, highlights and coordinates", () => {
        const css = boardCss({
            light: "#eeeed2",
            dark: "#769656",
            highlight: "#bbcb2b",
        });
        expect(css).toContain("background-color: #eeeed2");
        expect(css).toContain("data:image/svg+xml;utf8,");
        expect(css).toContain("square.last-move");
        expect(css).toContain(rgba("#bbcb2b", 0.41));
        expect(css).toContain("color: #769656");
    });

    it("keeps anything but a colour out of the CSS", () => {
        const css = boardCss({
            light: "red; } body { display: none",
            dark: "#769656",
        });
        expect(css).not.toContain("display: none");
        expect(css).toContain(
            `background-color: ${BOARD_PRESETS.classic.light}`,
        );
        expect(validColour("#ABCDEF", "#000000")).toBe("#abcdef");
        expect(validColour(42, "#000000")).toBe("#000000");
    });

    it("rgba reads #rrggbb", () => {
        expect(rgba("#ff8000", 0.5)).toBe("rgba(255, 128, 0, 0.5)");
    });

    it("every preset is valid colours", () => {
        for (const c of Object.values(BOARD_PRESETS))
            for (const v of [c.light, c.dark, c.highlight])
                expect(validColour(v, "")).toBe(v);
    });
});
