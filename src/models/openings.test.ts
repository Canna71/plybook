import { describe, expect, it } from "vitest";
import { Chess } from "chessops";
import { makeFen } from "chessops/fen";
import { parseSan } from "chessops/san";
import { namedOpenings, openingOfLine } from "./openingdata";
import { describeOpening, openingKey, parseOpenings } from "./openings";

/** The positions after each move of `sans`, from the start */
function line(sans: string): string[] {
    const pos = Chess.default();
    return sans.split(" ").map((san) => {
        pos.play(parseSan(pos, san)!);
        return makeFen(pos.toSetup());
    });
}

describe("opening names (lichess-org/chess-openings)", () => {
    it("reads every line of the bundled files", () => {
        // 3,865 named lines; a few name the same position
        expect(namedOpenings().size).toBeGreaterThan(3500);
    });

    it("names the Ruy Lopez, and its most specific variation", () => {
        const ruy = openingOfLine(line("e4 e5 Nf3 Nc6 Bb5"))!;
        expect(describeOpening(ruy)).toMatch(/^Ruy Lopez.* \(C\d\d\)$/);
        const morphy = openingOfLine(line("e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6"))!;
        expect(morphy.name).toMatch(/^Ruy Lopez: Morphy Defense/);
        expect(morphy.plies).toBeGreaterThan(ruy.plies);
    });

    it("keeps the last name once the game leaves the named lines", () => {
        const o = openingOfLine(line("e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 h4 h5"));
        expect(o?.name).toMatch(/^Ruy Lopez/);
    });

    it("names a transposition by where it arrives (the Nimzo-Indian from 1.c4)", () => {
        const direct = openingOfLine(line("d4 Nf6 c4 e6 Nc3 Bb4"))!;
        const via = openingOfLine(line("c4 Nf6 Nc3 e6 d4 Bb4"))!;
        expect(direct.name).toMatch(/^Nimzo-Indian Defense/);
        expect(via).toEqual(direct);
    });

    it("nothing for the starting position", () => {
        expect(openingOfLine([])).toBeUndefined();
    });
});

describe("parseOpenings", () => {
    it("skips a header, empty lines and illegal moves; the first name keeps a position", () => {
        const tsv = [
            "eco\tname\tpgn",
            "B00\tKing's Pawn Game\t1. e4",
            "B00\tAnother Name\t1. e4",
            "A00\tBroken\t1. e5",
            "",
        ].join("\n");
        const openings = parseOpenings([tsv]);
        expect(openings.size).toBe(1);
        expect([...openings.values()][0].name).toBe("King's Pawn Game");
    });

    it("leaves the en passant square out of the key", () => {
        expect(
            openingKey(
                "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
            ),
        ).toBe(
            openingKey(
                "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
            ),
        );
    });
});
