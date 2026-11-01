import { describe, expect, it } from "vitest";
import { boardText } from "./boardtext";

// 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 a6, White to move
const AFTER_A6 =
    "r1bqkb1r/1ppp1ppp/p1n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq - 0 5";
// the same, before a6: Black to move
const BEFORE_A6 =
    "r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4";

describe("boardText", () => {
    it("finds moves and squares", () => {
        expect(
            boardText(
                "White answers Nxf7, a fork of the queen on d8 and the rook on h8.",
                [AFTER_A6],
            ),
        ).toEqual([
            { text: "White answers " },
            { text: "Nxf7", from: "g5", to: "f7" },
            { text: ", a fork of the queen on " },
            { text: "d8", square: "d8" },
            { text: " and the rook on " },
            { text: "h8", square: "h8" },
            { text: "." },
        ]);
    });

    it("follows a line move by move", () => {
        const pieces = boardText("After Nxf7 Qe7 Nxh8: White wins material.", [
            AFTER_A6,
        ]);
        expect(pieces.filter((p) => "from" in p).map((p) => p.text)).toEqual([
            "Nxf7",
            "Qe7",
            "Nxh8",
        ]);
        expect(pieces[5]).toEqual({ text: "Nxh8", from: "f7", to: "h8" });
    });

    it("tries every position in play: the move, then the better move", () => {
        const pieces = boardText("a6 is a blunder. Better was d5.", [
            BEFORE_A6,
            AFTER_A6,
        ]);
        expect(pieces).toContainEqual({ text: "a6", from: "a7", to: "a6" });
        expect(pieces).toContainEqual({ text: "d5", from: "d7", to: "d5" });
    });

    it("goes on from a move only within a line", () => {
        // 1.e4, Black to move, and after 1...e6
        const before =
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";
        const after =
            "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
        const pieces = boardText(
            "e6 is passive. Only e5 keeps the balance. Better was e5.",
            [before, after],
        );
        expect(pieces.filter((p) => "from" in p)).toEqual([
            { text: "e6", from: "e7", to: "e6" },
            { text: "e5", from: "e7", to: "e5" },
            { text: "e5", from: "e7", to: "e5" },
        ]);
    });

    it("keeps checks and mates in the text", () => {
        const scholar =
            "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 4";
        expect(boardText("It stops Qxf7#.", [scholar])).toContainEqual({
            text: "Qxf7#",
            from: "h5",
            to: "f7",
        });
    });

    it("leaves numbers, words and unknown moves alone", () => {
        expect(
            boardText("Black wins material (+7) in 3 moves.", [AFTER_A6]),
        ).toEqual([{ text: "Black wins material (+7) in 3 moves." }]);
        // not legal anywhere here: plain text
        expect(boardText("Qh4 would be nice", [AFTER_A6])).toEqual([
            { text: "Qh4 would be nice" },
        ]);
    });
});
