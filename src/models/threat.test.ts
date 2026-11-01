import { describe, expect, it } from "vitest";
import { describeThreat, nullMoveFen } from "./threat";

describe("nullMoveFen", () => {
    it("passes the move to the other side", () => {
        expect(
            nullMoveFen(
                "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
            ),
        ).toBe("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2");
        expect(
            nullMoveFen(
                "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            ),
        ).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1");
    });

    it("is impossible in check", () => {
        // Black to move and in check from the bishop on b5
        expect(
            nullMoveFen(
                "rnbqkbnr/ppp1pppp/8/1B1p4/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 2",
            ),
        ).toBeUndefined();
    });

    it("rejects invalid FENs", () => {
        expect(nullMoveFen("not a fen")).toBeUndefined();
    });
});

describe("describeThreat", () => {
    // Scholar's mate set-up: if Black passes, White mates with Qxf7#
    const scholar = nullMoveFen(
        "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3",
    )!;

    it("names a mate and the capture", () => {
        expect(
            describeThreat(scholar, ["h5f7"], { type: "mate", value: 1 }),
        ).toEqual({
            san: "Qxf7#",
            text: "White threatens Qxf7# (checkmate, takes the pawn on f7)",
        });
    });

    it("uses the score from the threatening side's point of view", () => {
        // after 1. e4, if Black passes: Bc4 is quiet but leads to mate for White
        const start = nullMoveFen(
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        )!;
        expect(
            describeThreat(start, ["f1c4"], { type: "mate", value: 3 })?.text,
        ).toBe("White threatens Bc4 (mate in 3)");
        // a mate for Black (negative from White's view) is not White's threat
        expect(
            describeThreat(start, ["f1c4"], { type: "mate", value: -3 })?.text,
        ).toBe("White threatens Bc4");
    });

    it("describes a quiet threat without extras", () => {
        const start = nullMoveFen(
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
        )!;
        expect(describeThreat(start, ["d2d4"])?.text).toBe(
            "White threatens d4",
        );
    });

    it("ignores missing or illegal moves", () => {
        expect(describeThreat(scholar, undefined)).toBeUndefined();
        expect(describeThreat(scholar, ["e8e7"])).toBeUndefined();
    });
});
