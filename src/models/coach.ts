// The explanation model (P2.4b) only rewords: everything chess in the text was computed by the
// app (explain.ts). A rewording that names a move or a square the original does not is
// rejected, so a model that "calculates" anyway is never shown.

/** Moves in SAN (Nf3, exd5, O-O, e8=Q+) and bare squares (d5) */
const CHESS_WORDS =
    /\b(?:O-O(?:-O)?|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8]|[a-h][1-8])(?:=[QRBN])?[+#]?/g;

const chessWords = (text: string) =>
    new Set(
        [...text.matchAll(CHESS_WORDS)].map((m) => m[0].replace(/[+#]$/, "")),
    );

/**
 * Moves and squares in `reworded` that `original` does not have: a rewording is kept only
 * when this is empty.
 */
export function inventedChess(original: string, reworded: string): string[] {
    const known = chessWords(original);
    // a square the original names only inside a move (d5 in Nxd5) is fine on its own
    for (const word of [...known]) {
        const square = word.match(/[a-h][1-8]/g);
        square?.forEach((s) => known.add(s));
    }
    return [...chessWords(reworded)].filter((w) => !known.has(w));
}
