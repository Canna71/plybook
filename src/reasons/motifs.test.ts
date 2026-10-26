import { describe, expect, it } from "vitest";
import { lineMotifs, mainReasons, Motif } from "./motifs";

// Positions from Lichess puzzles (public domain), after the opponent's setting-up move.
const motifs = (fen: string, line: string[], previous?: string): Motif[] =>
    lineMotifs(fen, line, previous).map((r) => r.motif);
const main = (fen: string, line: string[]): Motif[] =>
    mainReasons(lineMotifs(fen, line)).map((r) => r.motif);

describe("lineMotifs", () => {
    it("finds a back-rank mate (puzzle 007HB: Qe1#)", () => {
        const fen =
            "rn2q1k1/pp3ppp/2pb4/3p1B2/2PN4/1Q6/PP3PPP/R1B4K b - - 0 15";
        expect(motifs(fen, ["e8e1"])).toEqual(["mate", "backRankMate"]);
    });

    it("calls a mate with a free square in front of the king just mate (001KR: Rf8#)", () => {
        const fen = "6k1/p1p3pp/4N3/1p6/2q1r1n1/2B5/PP4PP/3R1R1K w - - 0 29";
        expect(motifs(fen, ["f1f8"])).toEqual(["mate"]);
    });

    it("finds a fork cashed in (001kG: Qh5+ Kg8 Qxc5)", () => {
        const fen =
            "rnbq3r/1p3kpp/p4n2/2b5/2pNP3/2N5/PPP3PP/R1BQ1RK1 w - - 2 12";
        const found = lineMotifs(fen, ["d1h5", "f7g8", "h5c5"]);
        expect(found).toContainEqual({
            motif: "fork",
            ply: 0,
            squares: ["h5", "c5", "f7"],
        });
    });

    it("finds a pinned piece that cannot escape (00BSo: Bb4 Ra7 Bxc5)", () => {
        const fen = "2r3k1/4R1pp/p1p2p2/2N5/2P5/1Pb4P/P4PP1/6K1 b - - 0 25";
        expect(motifs(fen, ["c3b4", "e7a7", "b4c5"])).toContain("pin");
    });

    it("finds a skewer that wins the queen (001xl: Rf7+ Ke5 Rxf4)", () => {
        const fen = "8/4R3/p4kpp/3B4/5q2/8/5P1P/6K1 w - - 6 41";
        expect(lineMotifs(fen, ["e7f7", "f6e5", "f7f4"])).toContainEqual({
            motif: "skewer",
            ply: 0,
            squares: ["f7", "f6", "f4"],
        });
    });

    it("does not call it a skewer when the piece behind is defended by the king (00Bot)", () => {
        // Rxa6+ Ke5 Rxf6 Kxf6: the rook on f6 is traded, only the a6 pawn is won
        const fen = "8/5p2/p3kr2/8/8/R1P5/4P3/4K3 w - - 0 53";
        expect(motifs(fen, ["a3a6", "e6e5", "a6f6"])).not.toContain("skewer");
    });

    it("does not call a skewer that only trades a skewer (0018P: Re8+ Kf5 Rxe5+ Kxe5)", () => {
        const fen = "5R2/1p6/p1p1k3/2P1r3/2K3p1/2P1p1P1/1P5P/8 w - - 2 45";
        expect(motifs(fen, ["f8e8", "e6f5", "e8e5", "f5e5"])).not.toContain(
            "skewer",
        );
    });

    it("finds a hanging piece, but not a recapture (000Sa: Bxc2 Qa1+ Bb1)", () => {
        const fen = "2Q2bk1/5p1p/p5p1/2p3P1/4B3/7P/qPr2P2/2K4R w - - 0 33";
        const line = ["e4c2", "a2a1", "c2b1"];
        expect(motifs(fen, line)).toContain("hangingPiece");
        // had Black just taken on c2, Bxc2 would be taking back
        expect(motifs(fen, line, "d3c2")).not.toContain("hangingPiece");
    });

    it("finds nothing in an illegal or empty line", () => {
        const fen = "8/8/8/8/8/8/8/K6k w - - 0 1";
        expect(lineMotifs(fen, [])).toEqual([]);
        expect(lineMotifs(fen, ["e2e4"])).toEqual([]);
        expect(lineMotifs("not a fen", ["e2e4"])).toEqual([]);
    });
});

describe("mainReasons", () => {
    it("puts a mate before the fork on the way to it", () => {
        // 001kG's fork, then imagine the line had mated: forks give way to mate
        const reasons = [
            { motif: "fork" as const, ply: 0, squares: ["h5"] },
            { motif: "mate" as const, ply: 2, squares: ["h7"] },
        ];
        expect(mainReasons(reasons).map((r) => r.motif)).toEqual(["mate"]);
    });

    it("orders the rest by importance, then by when it happens", () => {
        const fen =
            "rnbq3r/1p3kpp/p4n2/2b5/2pNP3/2N5/PPP3PP/R1BQ1RK1 w - - 2 12";
        expect(main(fen, ["d1h5", "f7g8", "h5c5"])[0]).toBe("fork");
    });
});
