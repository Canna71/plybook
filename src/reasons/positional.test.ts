import { describe, expect, it } from "vitest";
import { positionalReasons } from "./positional";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const texts = (fen: string, uci: string) =>
    positionalReasons(fen, uci).map((r) => `${r.good ? "+" : "-"} ${r.text}`);

describe("positionalReasons", () => {
    it("knows the opening: the centre, development, castling", () => {
        expect(texts(START, "e2e4")).toEqual(["+ takes a share of the centre"]);
        expect(texts(START, "g1f3")).toEqual(["+ develops the knight"]);
        // 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5, White castles
        const italian =
            "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
        expect(texts(italian, "e1g1")).toEqual([
            "+ castles: the king is safer and a rook comes into play",
        ]);
    });

    it("does not call a capture in the centre a claim on it", () => {
        // 1.e4 d5 2.exd5
        const scandi =
            "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2";
        expect(texts(scandi, "e4d5")).not.toContain(
            "+ takes a share of the centre",
        );
    });

    it("puts a rook on an open file", () => {
        const fen = "3k4/p6p/8/8/8/8/P6P/R3K3 w - - 0 30";
        expect(texts(fen, "a1d1")).toContain(
            "+ puts the rook on the open d-file",
        );
    });

    it("creates and pushes passed pawns", () => {
        // the c-pawn takes on b5: no black pawn on a, b or c stops it any more
        const fen = "4k3/8/8/1p6/2P5/8/8/4K3 w - - 0 40";
        expect(texts(fen, "c4b5")).toContain("+ creates a passed pawn on b5");
        const passed = "4k3/8/8/8/2P5/8/8/4K3 w - - 0 40";
        expect(texts(passed, "c4c5")).toContain(
            "+ pushes the passed pawn to c5",
        );
    });

    it("finds an outpost for a knight", () => {
        // a knight to d5, defended by the e4 pawn, no black c- or e-pawn to chase it
        const fen = "4k3/pp3p1p/3p4/8/4P3/2N5/PP3PPP/4K3 w - - 0 20";
        expect(texts(fen, "c3d5")).toContain(
            "+ puts the knight on an outpost on d5",
        );
    });

    it("warns about the king's pawns while queens are on", () => {
        const fen = "3q2k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 25";
        expect(texts(fen, "g2g4")).toContain(
            "- weakens the pawns in front of the king",
        );
        // no queens: an endgame king does not need the shelter
        const endgame = "6k1/5ppp/8/8/8/8/5PPP/6K1 w - - 0 40";
        expect(texts(endgame, "g2g4")).not.toContain(
            "- weakens the pawns in front of the king",
        );
    });

    it("notices isolated pawns, its own and the opponent's", () => {
        // cxb5 takes the a-pawn's only neighbour; White's lone pawn was isolated already
        const fen = "4k3/8/p7/1p6/2P5/8/8/4K3 w - - 0 30";
        // (b5 is not passed: the a6 pawn can still take it)
        expect(texts(fen, "c4b5")).toEqual([
            "+ leaves the opponent an isolated pawn on a6",
        ]);
        // a pawn that walks away from its neighbour isolates itself
        const pair = "4k3/8/8/8/8/8/PP6/4K3 w - - 0 30";
        expect(texts(pair, "b2b4")).not.toContain(
            "- isolates its own pawn on b4",
        );
    });

    it("is empty for an illegal move", () => {
        expect(positionalReasons(START, "e2e5")).toEqual([]);
    });
});
