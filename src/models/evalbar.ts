// The evaluation bar beside the board (UX overhaul, step 4): how much of it is White's, on
// Lichess's win-probability scale, and the number to print. No DOM here, for tests.

import { Color } from "chessops";
import { Evaluation, isMate } from "chessops/pgn";
import { whiteCp, winPercent } from "./review";

export type EvalBar = {
    /** White's share of the bar, 0–100 */
    white: number;
    /** "+1.3", "−0.4", "0.0", "M3" (White mates), "−M2" (Black mates), "1-0" */
    label: string;
    /** Who the label favours, to print it on that side's colour */
    favours: Color;
};

/** The bar for an evaluation from White's point of view, with `turn` to move. */
export function evalBar(evaluation: Evaluation, turn: Color): EvalBar {
    const cp = whiteCp(evaluation, turn);
    const white = winPercent(cp);
    let label: string;
    if (isMate(evaluation)) {
        if (evaluation.mate === 0) label = turn === "white" ? "0-1" : "1-0";
        else
            label = `${evaluation.mate > 0 ? "" : "−"}M${Math.abs(evaluation.mate)}`;
    } else {
        const p = evaluation.pawns;
        label =
            Math.abs(p) < 0.05
                ? "0.0"
                : `${p > 0 ? "+" : "−"}${Math.abs(p).toFixed(1)}`;
    }
    return { white, label, favours: cp >= 0 ? "white" : "black" };
}
