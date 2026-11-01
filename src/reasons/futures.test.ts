import { describe, expect, it } from "vitest";
import { compareFutures } from "./futures";

// the owner's games (docs/EXPLANATIONS.md, F.37)
describe("compareFutures", () => {
    // 9.Re1 Qb6 Be3 Qxd4 Bxd4, where 9.e5 dxe5 Qxe5+ was better: Black's king still on e8
    const RE1 = {
        fen: "r2qkb1r/pp1b1ppp/2pp1n2/8/2BQP3/2N5/PPP2PPP/R1B2RK1 w kq - 0 9",
        uci: "f1e1",
        reply: ["d8b6", "c1e3", "b6d4", "e3d4", "f6h5", "g2g3"],
        best: ["e4e5", "d6e5", "d4e5", "d8e7", "e5g3", "d7e6"],
    };

    it("names the queens coming off with the king in the centre", () => {
        expect(compareFutures(RE1.fen, RE1.uci, RE1.reply, RE1.best)).toEqual({
            cost: "lets Black trade queens (Qxd4) while Black's king is still in the centre",
            gain: "keeps the queens on against Black's king in the centre",
        });
    });

    it("names a file opened on the king when the queens stay on in both lines", () => {
        // the same better line against an answer that keeps the queens on
        const quiet = ["h7h6", "a2a3"];
        expect(compareFutures(RE1.fen, RE1.uci, quiet, RE1.best)).toEqual({
            gain: "opens the e-file while Black's king is still on it",
        });
    });

    it("says nothing once the king is castled", () => {
        // 10...d5 exd5 exd5: both kings castled
        expect(
            compareFutures(
                "r2q1rk1/ppp3p1/2nppn1p/2b1p3/4P2B/P1NP1N2/1PP2PPP/R2Q1RK1 b - - 1 10",
                "d6d5",
                ["e4d5", "e6d5", "f1e1", "d8d7"],
                ["a7a5", "c3e2", "d8e8", "c2c3"],
            ),
        ).toEqual({});
    });
});
