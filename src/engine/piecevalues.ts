// Stockfish's NNUE piece values (P2.8 R3): its `eval` command prints, for every piece but the
// kings, how much the evaluation would change without it, in pawns from White's side (a knight
// on f3 +4.28, Black's bishop on c8 −4.48). A text table for people, not part of UCI, so it is
// parsed defensively: anything unexpected gives no values. Only Stockfish prints it.

/** By square name ("f3"); White's pieces positive, Black's negative */
export type PieceValues = Map<string, number>;

const TITLE = "NNUE derived piece values";

/** The piece values in `eval` output lines, or undefined when they are not there. */
export function parsePieceValues(lines: string[]): PieceValues | undefined {
    const start = lines.findIndex((l) => l.includes(TITLE));
    if (start < 0) return undefined;
    // the rows of cells, without the +---+ borders: pieces and values, rank 8 down to 1
    const rows = lines
        .slice(start + 1)
        .filter((l) => l.trim().startsWith("|"))
        .slice(0, 16)
        .map((l) =>
            l
                .trim()
                .split("|")
                .slice(1, -1)
                .map((c) => c.trim()),
        );
    if (rows.length !== 16 || rows.some((r) => r.length !== 8))
        return undefined;
    const values: PieceValues = new Map();
    for (let r = 0; r < 8; r++) {
        const pieces = rows[2 * r];
        const numbers = rows[2 * r + 1];
        for (let f = 0; f < 8; f++) {
            if (!pieces[f] || !numbers[f]) continue;
            const value = Number(numbers[f]);
            if (!Number.isFinite(value)) return undefined;
            values.set(`${"abcdefgh"[f]}${8 - r}`, value);
        }
    }
    return values;
}

/** The end of the `eval` output: the lines can be collected up to here */
export const isEvalEnd = (line: string) => line.startsWith("Final evaluation");
