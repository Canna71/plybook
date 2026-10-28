// Sacrifices (P2.4i, from Chesserly's "Brilliant": docs/EXPLANATIONS.md): the engine's line
// gives up material and gets it back, or mates, a few moves later. Read from the line played
// out, not from a static exchange count, so pins and x-rays are what the engine saw. Measured
// against the Lichess puzzles' "sacrifice" tag (docs/REASONS.md). Pure, for tests.

import {
    Chess,
    Color,
    makeSquare,
    opposite,
    parseSquare,
    parseUci,
    Role,
} from "chessops";
import { parseFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import { lineOutcome, materialBalance } from "../models/whatif";

/** How far into the line the material may be given (our first four moves) */
const SACRIFICE_PLIES = 8;

export type Sacrifice = {
    /** The line's first move, in SAN */
    san: string;
    /** Material down, in pawns, where the line is deepest in debt */
    given: number;
    /** Our piece the opponent took there, and where */
    role?: Role;
    square?: string;
    /** What the line gets for it: the material back, mate, or neither within the line */
    outcome: "regains" | "mates" | "neither";
};

const positionOf = (fen: string) => {
    const setup = parseFen(fen);
    const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    return pos?.isOk ? pos.value : undefined;
};

/**
 * The sacrifices said in explanations (docs/REASONS.md): two pawns' worth or more, taken at
 * once, offered by the move, and won back or mate within the line. Sacrifices the line does not
 * pay for were mostly desperate or material lost anyway, so they are not said.
 */
export function saidSacrifice(
    fen: string,
    pv: string[],
): (Sacrifice & { role: Role; square: string }) | undefined {
    const s = sacrifice(fen, pv);
    return s && s.outcome !== "neither" && s.role && s.square
        ? { ...s, role: s.role, square: s.square }
        : undefined;
}

/** "sacrifices the bishop on h7, and the engine's line wins the material back" */
export const describeSacrifice = (
    s: { role: Role; square: string } & Sacrifice,
) =>
    `sacrifices the ${s.role} on ${s.square}, and the engine's line ${s.outcome === "mates" ? "ends in mate" : "wins the material back"}`;

/**
 * Whether `pv` from `fen` is a sacrifice for the side to move: after one of the opponent's
 * replies within the first SACRIFICE_PLIES, that side is `min` pawns or more down on where it
 * started, and still is after its own next move (a trade that ends in a capture back is not a
 * sacrifice).
 */
export function sacrifice(
    fen: string,
    pv: string[],
    min = 2,
    /** Only material the opponent takes at once, on the first reply (the move offers it) */
    atOnce = true,
): Sacrifice | undefined {
    const pos = positionOf(fen);
    if (!pos || !pv.length) return undefined;
    const side: Color = pos.turn;
    const start = materialBalance(pos, side);
    const first = parseUci(pv[0]);
    if (!first || !pos.isLegal(first)) return undefined;
    const san = makeSan(pos, first);
    // the balance after each ply, and what the opponent took
    const balance: number[] = [];
    const taken: ({ role: Role; square: string } | undefined)[] = [];
    for (const uci of pv.slice(0, SACRIFICE_PLIES + 1)) {
        const move = parseUci(uci);
        if (!move || !pos.isLegal(move)) break;
        const victim = "from" in move ? pos.board.get(move.to) : undefined;
        taken.push(
            victim?.color === side && "from" in move
                ? { role: victim.role, square: makeSquare(move.to) }
                : undefined,
        );
        pos.play(move);
        balance.push(materialBalance(pos, side) - start);
    }
    let deepest = 0;
    let at = -1;
    const last = atOnce ? 2 : SACRIFICE_PLIES;
    for (let i = 1; i < Math.min(balance.length, last); i += 2) {
        // still down after our next move, when the line goes on
        const owed = -Math.max(balance[i], balance[i + 1] ?? balance[i]);
        if (owed > deepest) {
            deepest = owed;
            at = i;
        }
    }
    if (deepest < min) return undefined;
    // the opponent's capture that put us deepest in debt, or the last one before it
    const capture = taken
        .slice(0, at + 1)
        .reverse()
        .find((t) => t !== undefined);
    // offered by the move: the piece that moved, or one the opponent did not attack before.
    // A piece already attacked and taken while we did something else is not a sacrifice
    const startPos = positionOf(fen)!;
    if (
        capture &&
        "from" in first &&
        capture.square !== makeSquare(first.to) &&
        startPos
            .kingAttackers(
                parseSquare(capture.square)!,
                opposite(side),
                startPos.board.occupied,
            )
            .nonEmpty()
    )
        return undefined;
    const outcome = lineOutcome(fen, pv, side, SACRIFICE_PLIES + 2);
    return {
        san,
        given: deepest,
        role: capture?.role,
        square: capture?.square,
        outcome:
            outcome?.mated && outcome.mated !== side
                ? "mates"
                : (outcome?.materialChange ?? -deepest) >= 0
                  ? "regains"
                  : "neither",
    };
}
