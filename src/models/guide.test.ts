import { describe, expect, it } from "vitest";
import guideText from "../../docs/GUIDE.md?raw";
import {
    anchorOf,
    parseGuide,
    searchGuide,
    sectionOfLink,
    withoutImages,
} from "./guide";
import { allNavItems } from "./navigation";

const SAMPLE = `# Guide

Intro text.

![shot](screenshots/a.png)

## First steps
<!-- help: start -->

Add an engine. See [Your data](#your-data).

## Your data

Files are kept here.
`;

describe("guide", () => {
    it("splits the guide into sections named by their id line", () => {
        const guide = parseGuide(SAMPLE);
        expect(guide.title).toBe("Guide");
        expect(withoutImages(guide.intro)).toBe("Intro text.");
        expect(guide.sections.map((s) => s.id)).toEqual(["start", "your-data"]);
        expect(guide.sections[0]).toMatchObject({
            title: "First steps",
            anchor: "first-steps",
            body: "Add an engine. See [Your data](#your-data).",
        });
    });

    it("makes anchors as GitHub does", () => {
        expect(anchorOf("Play the engine")).toBe("play-the-engine");
        expect(anchorOf("Scan a position (beta)")).toBe("scan-a-position-beta");
    });

    it("finds sections by every word, and links by anchor or id", () => {
        const guide = parseGuide(SAMPLE);
        expect(searchGuide(guide, "ENGINE add").map((s) => s.id)).toEqual([
            "start",
        ]);
        expect(searchGuide(guide, "  ")).toHaveLength(2);
        expect(searchGuide(guide, "nothing here")).toEqual([]);
        expect(sectionOfLink(guide, "#your-data")?.id).toBe("your-data");
        expect(sectionOfLink(guide, "#start")?.id).toBe("start");
        expect(sectionOfLink(guide, "https://example.com")).toBeUndefined();
    });

    it("has a section for every screen, and its links lead somewhere", () => {
        const guide = parseGuide(guideText);
        const ids = guide.sections.map((s) => s.id);
        for (const item of allNavItems())
            if (item.id !== "help") expect(ids).toContain(item.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const s of guide.sections)
            for (const [, href] of s.body.matchAll(/\]\((#[^)]+)\)/g))
                expect(
                    sectionOfLink(guide, href),
                    `${s.id}: ${href}`,
                ).toBeDefined();
    });
});
