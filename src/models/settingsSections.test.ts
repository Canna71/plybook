import { describe, expect, it } from "vitest";
import {
    findSections,
    sectionById,
    SETTINGS_SECTIONS,
} from "./settingsSections";

const ids = (query: string) => findSections(query).map((s) => s.id);

describe("findSections", () => {
    it("lists every section for an empty query", () => {
        expect(ids("  ")).toEqual(SETTINGS_SECTIONS.map((s) => s.id));
    });
    it("finds sections by name first, then by what they hold", () => {
        expect(ids("dark")).toEqual(["appearance"]);
        expect(ids("stockfish")).toEqual(["engines"]);
        expect(ids("LICHESS token")).toEqual(["accounts"]);
        expect(ids("book")[0]).toBe("books");
        expect(ids("restore")).toEqual(["backups"]);
        expect(ids("nothing like this")).toEqual([]);
    });
});

describe("sectionById", () => {
    it("falls back to the first section", () => {
        expect(sectionById("backups").id).toBe("backups");
        expect(sectionById(undefined).id).toBe("appearance");
        expect(sectionById("gone").id).toBe("appearance");
    });
});
