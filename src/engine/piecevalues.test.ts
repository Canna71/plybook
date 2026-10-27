import { describe, expect, it } from "vitest";
import { isEvalEnd, parsePieceValues } from "./piecevalues";

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
