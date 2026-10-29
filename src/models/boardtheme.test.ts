import { describe, expect, it } from "vitest";
import {
    BOARD_PRESETS,
    BOARD_TEXTURES,
    boardCss,
    boardSvg,
    coordinatesConfig,
    highlightCss,
    rgba,
    textureOf,
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

    it("draws a texture from its file, coordinates in its measured colours", () => {
        const wood = textureOf("texture:wood")!;
        const css = boardCss(wood, wood.file);
        expect(css).toContain('url("/boards/wood.jpg")');
        expect(css).toContain("background-size: cover");
        expect(css).toContain(`color: ${wood.dark}`);
        // only plain file names of ours: anything else draws the two colours
        expect(boardCss(wood, "../x.jpg")).not.toContain("/boards/");
        expect(textureOf("wood")).toBeUndefined();
        expect(textureOf("texture:nothing")).toBeUndefined();
    });

    it("every texture's file is a plain name, and its colours valid", () => {
        for (const t of Object.values(BOARD_TEXTURES)) {
            expect(t.file).toMatch(/^[a-z0-9_]+\.(jpg|png)$/);
            for (const v of [t.light, t.dark, t.highlight])
                expect(validColour(v, "")).toBe(v);
        }
    });

    it("the highlight rules alone, for a colour over any board", () => {
        const css = highlightCss("#ff0000");
        expect(css).toContain("square.last-move");
        expect(css).toContain(rgba("#ff0000", 0.41));
        expect(css).not.toContain("cg-board {");
    });

    it("coordinates: none, the edges, every square", () => {
        expect(coordinatesConfig("off")).toEqual({
            coordinates: false,
            coordinatesOnSquares: false,
        });
        expect(coordinatesConfig("edges").coordinates).toBe(true);
        expect(coordinatesConfig("squares").coordinatesOnSquares).toBe(true);
        expect(coordinatesConfig(undefined).coordinates).toBe(true);
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
