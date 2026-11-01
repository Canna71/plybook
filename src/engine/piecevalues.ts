// Stockfish's NNUE piece values (P2.8 R3): its `eval` command prints, for every piece but the
// kings, how much the evaluation would change without it, in pawns from White's side (a knight
// on f3 +4.28, Black's bishop on c8 −4.48). A text table for people, not part of UCI, so it is
// parsed defensively: anything unexpected gives no values. Only Stockfish prints it.

import { Chess, makeSquare, parseSquare, Role } from "chessops";
import { makeFen, parseFen } from "chessops/fen";

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

// #region derived values: Stockfish 19 no longer prints the table (F.45), so the values are
// made the way it made them: the NNUE evaluation with each piece, less without it

/** The NNUE evaluation from White's side in `eval` output, in pawns ("NNUE evaluation +0.21 (white side)"). */
export function nnueWhite(lines: string[]): number | undefined {
    for (const line of lines) {
        const m = line.match(
            /^NNUE evaluation\s+([+-]?\s*\d+(?:\.\d+)?)\s+\(white side\)/,
        );
        if (m) return Number(m[1].replace(/\s/g, ""));
    }
    return undefined;
}

/** The squares whose piece gets a value: all but kings and pawns, as the scale needs them. */
export function valuedSquares(fen: string): string[] {
    const setup = parseFen(fen);
    if (setup.isErr) return [];
    const out: string[] = [];
    for (const sq of setup.value.board.occupied) {
        const role = setup.value.board.get(sq)!.role;
        if (role !== "king" && role !== "pawn") out.push(makeSquare(sq));
    }
    return out;
}

/**
 * The position without the piece on `square` (its castling right gone with a rook); none when
 * that is not a legal position (it uncovers a check on the side that just moved): an engine
 * may hang or crash on one.
 */
export function withoutPiece(fen: string, square: string): string | undefined {
    const setup = parseFen(fen);
    const sq = parseSquare(square);
    if (setup.isErr || sq === undefined || !setup.value.board.has(sq))
        return undefined;
    const s = setup.value;
    s.board.take(sq);
    s.castlingRights = s.castlingRights.without(sq);
    return Chess.fromSetup(s).isOk ? makeFen(s) : undefined;
}

/** A piece's usual value in these units (Stockfish 17's table, opening), to set the scale */
const USUAL: Partial<Record<Role, number>> = {
    knight: 4,
    bishop: 4.3,
    rook: 5.3,
    queen: 9,
};

/**
 * The values from the evaluations: `base` with every piece, `without` each square's piece
 * gone (a square left out when its position could not be evaluated, as with the side to move
 * in check). Stockfish 19's numbers run larger than 17's table (a knight about 5.8 where it
 * printed 4), so they are scaled for the pieces' usual values to add up as the table's did.
 */
export function derivedValues(
    fen: string,
    base: number,
    without: Map<string, number>,
): PieceValues | undefined {
    const setup = parseFen(fen);
    if (setup.isErr || !without.size) return undefined;
    const raw = new Map<string, number>();
    let usual = 0;
    let measured = 0;
    for (const [square, value] of without) {
        const piece = setup.value.board.get(parseSquare(square)!);
        if (!piece || !USUAL[piece.role]) continue;
        const v = base - value;
        raw.set(square, v);
        usual += USUAL[piece.role]!;
        measured += Math.abs(v);
    }
    if (!raw.size || measured <= 0) return undefined;
    const scale = usual / measured;
    return new Map([...raw].map(([sq, v]) => [sq, v * scale]));
}
// #endregion
