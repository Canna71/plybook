import { describe, expect, it } from "vitest";
import {
    derivedValues,
    isEvalEnd,
    nnueWhite,
    parsePieceValues,
    valuedSquares,
    withoutPiece,
} from "./piecevalues";

// Stockfish 19 prints no table: the values come from evaluations with and without each piece
describe("derived piece values (F.45)", () => {
    // its `eval` after 1.e4 (abridged)
    const SF19 = [
        "NNUE evaluation          -60 (side to move, internal units)",
        "NNUE evaluation        +0.21 (white side)",
        "Final evaluation      +0.27 (white side) [with scaled NNUE, ...]",
    ];
    const AFTER_E4 =
        "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

    it("reads the NNUE evaluation from White's side, and none in check", () => {
        expect(parsePieceValues(SF19)).toBeUndefined();
        expect(nnueWhite(SF19)).toBe(0.21);
        expect(nnueWhite(["NNUE evaluation        -5.59 (white side)"])).toBe(
            -5.59,
        );
        expect(nnueWhite(["Final evaluation: none (in check)"])).toBe(
            undefined,
        );
    });

    it("takes a piece off, with its castling right", () => {
        expect(withoutPiece(AFTER_E4, "g1")).toBe(
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 1",
        );
        expect(withoutPiece(AFTER_E4, "h1")).toBe(
            "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBN1 b Qkq - 0 1",
        );
        expect(withoutPiece(AFTER_E4, "e5")).toBeUndefined();
        // the rook shields White's king from the queen, White having just moved: taking it
        // off would leave the side that moved in check, which is no position
        expect(withoutPiece("4q1k1/8/8/8/8/8/4R3/4K3 b - - 0 1", "e2")).toBe(
            undefined,
        );
        expect(valuedSquares(AFTER_E4)).toHaveLength(14);
    });

    it("values a piece as the evaluation it brings, on the old table's scale", () => {
        // the knights only: 5.8 each raw, scaled so that they add up to two usual knights
        const values = derivedValues(
            AFTER_E4,
            0.21,
            new Map([
                ["g1", -5.59],
                ["g8", 6.01],
            ]),
        )!;
        expect(values.get("g1")).toBeCloseTo(4, 5);
        expect(values.get("g8")).toBeCloseTo(-4, 5);
    });
});

// Stockfish 17's `eval` after 1.e4 e5 2.Nf3 Nc6 (abridged after the table)
const OUTPUT = `
 NNUE derived piece values:
+-------+-------+-------+-------+-------+-------+-------+-------+
|   r   |       |   b   |   q   |   k   |   b   |   n   |   r   |
| -5.36 |       | -4.48 | -10.1 |       | -4.31 | -4.08 | -5.43 |
+-------+-------+-------+-------+-------+-------+-------+-------+
|   p   |   p   |   p   |   p   |       |   p   |   p   |   p   |
| -0.76 | -1.42 | -1.43 | -1.14 |       | -1.45 | -1.37 | -0.49 |
+-------+-------+-------+-------+-------+-------+-------+-------+
|       |       |   n   |       |       |       |       |       |
|       |       | -4.77 |       |       |       |       |       |
+-------+-------+-------+-------+-------+-------+-------+-------+
|       |       |       |       |   p   |       |       |       |
|       |       |       |       | -1.87 |       |       |       |
+-------+-------+-------+-------+-------+-------+-------+-------+
|       |       |       |       |   P   |       |       |       |
|       |       |       |       | +1.80 |       |       |       |
+-------+-------+-------+-------+-------+-------+-------+-------+
|       |       |       |       |       |   N   |       |       |
|       |       |       |       |       | +4.28 |       |       |
+-------+-------+-------+-------+-------+-------+-------+-------+
|   P   |   P   |   P   |   P   |       |   P   |   P   |   P   |
| +0.49 | +0.97 | +1.20 | +0.62 |       | +1.26 | +1.42 | +0.58 |
+-------+-------+-------+-------+-------+-------+-------+-------+
|   R   |   N   |   B   |   Q   |   K   |   B   |       |   R   |
| +5.23 | +4.08 | +4.43 | +8.56 |       | +4.71 |       | +5.63 |
+-------+-------+-------+-------+-------+-------+-------+-------+

 NNUE network contributions (White to move)
+------------+------------+------------+------------+
|   Bucket   |  Material  | Positional |   Total    |
+------------+------------+------------+------------+
|  7         |  +  0.00   |  +  0.13   |  +  0.13   | <-- this bucket is used
+------------+------------+------------+------------+

NNUE evaluation        +0.13 (white side)
Final evaluation       +0.17 (white side) [with scaled NNUE, ...]`.split("\n");

describe("parsePieceValues", () => {
    it("reads every piece but the kings, by square, White positive", () => {
        const values = parsePieceValues(OUTPUT)!;
        expect(values.get("f3")).toBe(4.28);
        expect(values.get("c6")).toBe(-4.77);
        expect(values.get("d8")).toBe(-10.1);
        expect(values.get("a1")).toBe(5.23);
        expect(values.has("e1")).toBe(false); // the king
        expect(values.has("e4")).toBe(true);
        expect(values.size).toBe(30);
    });

    it("gives nothing for other engines' output or a broken table", () => {
        expect(parsePieceValues(["info string hello", "bestmove e2e4"])).toBe(
            undefined,
        );
        expect(parsePieceValues(OUTPUT.slice(0, 10))).toBeUndefined();
    });

    it("knows where the output ends", () => {
        expect(OUTPUT.some(isEvalEnd)).toBe(true);
        expect(isEvalEnd("NNUE evaluation        +0.13")).toBe(false);
    });
});
