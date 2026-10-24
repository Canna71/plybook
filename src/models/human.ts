// Comparing the move most players would choose (Maia) with the engine's lines: when the
// natural move is a mistake, the position holds a trap.

import { Color } from "chessops";
import { Score } from "../engine/engineinterfaces";
import { whiteCp, winPercent } from "./review";

export type EngineLine = { pv?: string[]; score?: Score };

export type HumanVerdict =
    | { kind: "best" }
    | { kind: "fine" }
    /** the natural move loses `loss` win-percentage points against the best line */
    | { kind: "trap"; loss: number }
    /** the engine does not rank the move among its lines */
    | { kind: "unranked" };

/** Below this many win-percentage points lost the natural move counts as fine (a mistake
 * by the review rules starts at 10). */
const TRAP_LOSS = 10;

/** `lines` are the engine's lines for the position (scores from White's point of view). */
export function judgeHumanMove(
    uci: string,
    lines: EngineLine[],
    turn: Color,
): HumanVerdict | undefined {
    const best = lines[0];
    if (!best?.pv?.length || !best.score) return undefined;
    if (best.pv[0] === uci) return { kind: "best" };
    const line = lines.find((l) => l.pv?.[0] === uci);
    if (!line?.score) return { kind: "unranked" };
    const win = (score: Score) => {
        const w = winPercent(
            whiteCp(
                score.type === "cp"
                    ? { pawns: score.value / 100 }
                    : { mate: score.value },
                turn,
            ),
        );
        return turn === "white" ? w : 100 - w;
    };
    const loss = Math.max(0, win(best.score) - win(line.score));
    return loss >= TRAP_LOSS ? { kind: "trap", loss } : { kind: "fine" };
}
