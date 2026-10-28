import { describe, expect, it } from "vitest";
import { describeSacrifice, sacrifice, saidSacrifice } from "./sacrifice";

// positions from Lichess games (2013, CC0), lines from Stockfish at depth 16
const GREEK_GIFT =
    "rn1qnrk1/pb2bppp/1p1pp3/2p1P3/3P1P1P/3B1N2/PPP1Q1P1/RNB1K2R w KQ - 0 10";
const GREEK_LINE = "d3h7 g8h7 f3g5 h7g8 e2h5 b7e4 g5e4 d6e5".split(" ");

describe("sacrifice", () => {
    it("the Greek gift: Bxh7+ Kxh7 Ng5+, the material comes back", () => {
        const s = saidSacrifice(GREEK_GIFT, GREEK_LINE)!;
        expect(s.san).toBe("Bxh7+");
        expect(s.given).toBe(2);
        expect(describeSacrifice(s)).toBe(
            "sacrifices the bishop on h7, and the engine's line wins the material back",
        );
    });

    it("a sacrifice for mate: Bg6+ hxg6 Qxg6#", () => {
        const fen =
            "rnb1kbnr/pp1p2pp/4p3/q5B1/2Pp4/2NBPN2/PPQ2PPP/R3K2R w KQkq - 0 10";
        expect(saidSacrifice(fen, ["d3g6", "h7g6", "c2g6"])?.outcome).toBe(
            "mates",
        );
    });

    it("an exchange sacrifice: Rxf5 Qxf5 Nd6", () => {
        const fen =
            "r3r1k1/pp1q1ppp/2n5/4pb1B/2PpN3/3P2P1/PP4KP/R2Q1R2 w - - 4 18";
        const line = "f1f5 d7f5 e4d6 f5d7 h5f7 g8h8 f7e8 d7d6".split(" ");
        expect(saidSacrifice(fen, line)?.role).toBe("rook");
    });

    it("not a piece that was attacked already (Bxd4 while the queen hangs)", () => {
        const fen =
            "1r1qkb1r/p1p1pp1p/5np1/8/2Pn4/1P4P1/PB1PbPBP/RN1QK2R w KQk - 0 10";
        const line = "b2d4 e2d1 g2c6 f6d7 e1d1 h8g8 b1c3 f8g7".split(" ");
        expect(sacrifice(fen, line)).toBeUndefined();
    });

    it("not said when the line does not pay it back", () => {
        const fen =
            "r4b1r/pp1bnkp1/1q2p2p/2ppP3/5PB1/2PP1K1P/PP1N4/R1BR4 w - - 0 18";
        const line = "d2e4 d5e4 d3e4 h6h5 g4h5 h8h5 d1d7 f7g8".split(" ");
        expect(sacrifice(fen, line)?.outcome).toBe("neither");
        expect(saidSacrifice(fen, line)).toBeUndefined();
    });

    it("not a trade, nor a pawn gambit", () => {
        // Ruy Lopez: Bxc6 dxc6 is an exchange
        const ruy =
            "r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4";
        expect(sacrifice(ruy, ["b5c6", "d7c6", "e1g1"])).toBeUndefined();
        // the King's Gambit gives a pawn: less than the two needed
        const kings =
            "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
        expect(sacrifice(kings, ["f2f4", "e5f4", "g1f3"])).toBeUndefined();
        expect(sacrifice(kings, ["f2f4", "e5f4", "g1f3"], 1)?.given).toBe(1);
    });
});
