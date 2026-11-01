// Lc0 extras. With VerboseMoveStats on, after a search Lc0 prints one "info string" per legal
// move with its policy (P: 33.01%): for a Maia net, how often players of its rating choose it.

export type MoveStat = { uci: string; policy: number };

const MOVE_STAT = /^([a-h][1-8][a-h][1-8][qrbn]?)\s.*\(P:\s*([\d.]+)%\)/;

/** One "info string" payload, e.g. "g8f6  (159 ) N: 0 (+ 0) (P: 33.01%) ...". */
export function parseMoveStat(text: string): MoveStat | undefined {
    const match = MOVE_STAT.exec(text.trim());
    return match ? { uci: match[1], policy: parseFloat(match[2]) } : undefined;
}

/** The most likely moves, most likely first. */
export const topMoves = (stats: MoveStat[], count = 3, minPolicy = 5) =>
    [...stats]
        .sort((a, b) => b.policy - a.policy)
        .filter((s, i) => i === 0 || s.policy >= minPolicy)
        .slice(0, count);
