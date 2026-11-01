// The explanation model (P2.4b) says what the computed explanation and its evidence show
// (F.37d): everything chess in them was computed by the app (explain.ts). A wording that names
// a move or a square they do not is rejected, so a model that "calculates" anyway is never
// shown.

import type { EvidenceLine, MoveExplanation } from "./explain";

/**
 * What the model is given (F.37d): the explanation and the evidence behind it, the engine's
 * lines in moves, the readings marked as not certain. The model may say what this shows, and
 * its text is checked against all of it (`rewordingProblems(brief, text)`), so it can name a
 * move of a line the sentences leave out, never one of its own.
 */
export function coachBrief(x: MoveExplanation): string {
    const BASIS = {
        board: "fact on the board",
        line: "from the engine's line",
        interpretation: "a reading, not certain",
    };
    const line = (l: EvidenceLine) =>
        `${l.label === "reply" ? `The answer to ${x.move.san}` : `The better line`}: ${l.san.join(" ")}`;
    return [
        `Explanation: ${x.text.join(" ")}`,
        ...(x.evidence.length
            ? [
                  "Evidence:",
                  ...x.evidence.map((e) => `- ${e.text} (${BASIS[e.basis]})`),
              ]
            : []),
        ...(x.lines.length ? ["Engine lines:", ...x.lines.map(line)] : []),
    ].join("\n");
}

/** Moves in SAN (Nf3, exd5, O-O, e8=Q+) and bare squares (d5) */
const CHESS_WORDS =
    /\b(?:O-O(?:-O)?|[KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8]|[a-h][1-8])(?:=[QRBN])?[+#]?/g;

const chessWords = (text: string) =>
    new Set(
        [...text.matchAll(CHESS_WORDS)].map((m) => m[0].replace(/[+#]$/, "")),
    );

/**
 * Tactical and material claims, by the word that makes them: a rewording may not add one the
 * explanation does not make ("wins" where it says nothing is won, "fork" where it says double
 * attack)
 */
const CLAIMS: [string, RegExp][] = [
    ["fork", /\bfork/i],
    ["pin", /\bpin(s|ned|ning)?\b/i],
    ["skewer", /\bskewer/i],
    ["discovered", /\bdiscover/i],
    ["double check", /\bdouble check/i],
    ["mate", /\bmate|\bcheckmat/i],
    ["wins", /\bwin(s|ning)?\b|\bwon\b/i],
    ["sacrifice", /\bsacrific/i],
    ["trap", /\btrap/i],
    ["undefended", /\bundefended|\bhanging|\bunprotected/i],
    ["blunder", /\bblunder/i],
];

/** Claims `reworded` makes that `original` does not. */
export function inventedClaims(original: string, reworded: string): string[] {
    return CLAIMS.filter(
        ([, word]) => word.test(reworded) && !word.test(original),
    ).map(([name]) => name);
}

/** Everything a rewording adds: moves, squares and claims. Kept only when this is empty. */
export const rewordingProblems = (original: string, reworded: string) => [
    ...inventedChess(original, reworded),
    ...inventedClaims(original, reworded),
];

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
