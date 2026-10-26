import { describe, expect, it } from "vitest";
import {
    createdThreat,
    describeIdea,
    isThreat,
    lineIdea,
    stoppedThreat,
} from "./threats";

// 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6, White to play 4.Ng5 (the Fried Liver)
const BEFORE_NG5 =
    "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
// after 4.Ng5, Black to move
const AFTER_NG5 =
    "r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4";
// White's idea if Black passed: Nxf7, Qe7, Nxh8
const NXF7 = ["g5f7", "d8e7", "f7h8"];

// 1.e4 e5 2.Qh5 Nc6, White to play 3.Bc4 (and Qxf7#)
const BEFORE_BC4 =
    "r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3";
const AFTER_BC4 =
    "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3";

describe("lineIdea", () => {
    it("names a fork and the material it wins", () => {
        const fen =
            "r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq - 5 5";
        const idea = lineIdea(fen, NXF7)!;
        expect(idea.san).toBe("Nxf7");
        expect(idea.motif?.motif).toBe("fork");
        expect(idea.motif?.pieces).toEqual([
            "knight on f7",
            "queen on d8",
            "rook on h8",
        ]);
        expect(idea.gain).toBeGreaterThanOrEqual(5);
        expect(isThreat(idea)).toBe(true);
    });

    it("names the piece taken, not the one taking it (puzzle 000Sa: Bxc2)", () => {
        const fen = "2Q2bk1/5p1p/p5p1/2p3P1/4B3/7P/qPr2P2/2K4R w - - 0 33";
        const idea = lineIdea(fen, ["e4c2", "a2a1", "c2b1"])!;
        expect(describeIdea(idea)).toBe(
            "Bxc2, winning the rook on c2, which nothing defends",
        );
    });

    it("is undefined for an illegal first move", () => {
        expect(lineIdea(AFTER_NG5, ["e2e4"])).toBeUndefined();
    });
});

describe("createdThreat", () => {
    it("Ng5 threatens Nxf7, forking queen and rook", () => {
        const idea = createdThreat(BEFORE_NG5, "f3g5", NXF7)!;
        expect(describeIdea(idea)).toBe(
            "Nxf7, a fork of the queen on d8 and the rook on h8",
        );
    });

    it("Bc4 threatens mate on f7", () => {
        const idea = createdThreat(BEFORE_BC4, "f1c4", ["h5f7"])!;
        expect(idea.mates).toBe(true);
        expect(describeIdea(idea)).toBe("Qxf7#");
    });

    it("a quiet line threatens nothing", () => {
        // after 3.Bc4, if Black passed: a quiet knight move
        expect(createdThreat(BEFORE_BC4, "f1c4", ["g1f3"])).toBeUndefined();
    });
});

describe("stoppedThreat", () => {
    it("Qe7 stops the fork on f7, a6 does not", () => {
        expect(describeIdea(stoppedThreat(AFTER_NG5, "d8e7", NXF7)!)).toBe(
            "Nxf7, a fork of the queen on d8 and the rook on h8",
        );
        expect(stoppedThreat(AFTER_NG5, "a7a6", NXF7)).toBeUndefined();
    });

    it("g6 stops Qxf7# by blocking the queen's diagonal", () => {
        const idea = stoppedThreat(AFTER_BC4, "g7g6", ["h5f7"])!;
        expect(idea.mates).toBe(true);
        expect(stoppedThreat(AFTER_BC4, "a7a6", ["h5f7"])).toBeUndefined();
    });

    it("trusts the engine's reply: still mated another way means nothing was stopped", () => {
        // after a6, the reply Qxf7# is the same threat: not stopped
        expect(
            stoppedThreat(AFTER_BC4, "a7a6", ["h5f7"], ["h5f7"]),
        ).toBeUndefined();
    });
});
