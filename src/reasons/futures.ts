// The two futures of a mistake (F.37c, docs/EXPLANATIONS.md): where the engine's answer to the
// played move leads, against where its better move leads, compared on what a coach would name
// when no material is won. Readings of the position, so interpretations in the evidence.
//
// - The queens come off while the opponent's king is still in the centre: the played move lets
//   them be traded, the better one keeps them on (9.Re1 Qb6, 12.e5 Qxe3 in the owner's games).
// - A file opens with the opponent's king on it: the better line clears the pawns from the file
//   of the king still in the centre (9.e5 dxe5 Qxe5+).

import {
    Chess,
    Color,
    opposite,
    parseUci,
    Position,
    squareFile,
} from "chessops";
import { parseFen } from "chessops/fen";
import { makeSan } from "chessops/san";

/** Plies of a line read, extended while captures go on, as lineOutcome reads them */
const PLIES = 6;
const MAX_PLIES = 10;

const SIDE = { white: "White", black: "Black" };
const FILES = "abcdefgh";

const positionOf = (fen: string) => {
    const setup = parseFen(fen);
    const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    return pos?.isOk ? pos.value : undefined;
};

/** The positions along a line from `fen`, the start first, with each move's SAN. */
function walk(fen: string, pv: string[]) {
    const pos = positionOf(fen);
    if (!pos) return [];
    const steps: { pos: Position; san?: string }[] = [{ pos: pos.clone() }];
    for (const uci of pv) {
        const move = parseUci(uci);
        if (!move || !pos.isLegal(move)) break;
        const capture = "from" in move && pos.board.has(move.to);
        if (steps.length > PLIES && !capture) break;
        const san = makeSan(pos, move);
        pos.play(move);
        steps.push({ pos: pos.clone(), san });
        if (steps.length > MAX_PLIES) break;
    }
    return steps;
}

const queens = (pos: Position, color: Color) =>
    pos.board.pieces(color, "queen").size();

/** The king still in the centre: on its back rank between c and f, or just in front of it. */
function kingInCentre(pos: Position, color: Color): boolean {
    const king = pos.board.kingOf(color);
    if (king === undefined) return false;
    const file = squareFile(king);
    const rank = color === "white" ? king >> 3 : 7 - (king >> 3);
    return rank <= 1 && file >= 2 && file <= 5;
}

/** Whether a pawn of either side stands on `file`. */
const pawnOn = (pos: Position, file: number) =>
    [...pos.board.pawn].some((sq) => squareFile(sq) === file);

/**
 * The queens traded in a line: the move that takes the first queen, when by the end both are
 * gone and both were there at its start.
 */
function queenTrade(steps: ReturnType<typeof walk>): string | undefined {
    const start = steps[0]?.pos;
    const end = steps.at(-1)?.pos;
    if (!start || !end) return undefined;
    if (!queens(start, "white") || !queens(start, "black")) return undefined;
    if (queens(end, "white") || queens(end, "black")) return undefined;
    for (let i = 1; i < steps.length; i++) {
        const before = steps[i - 1].pos;
        const after = steps[i].pos;
        if (
            queens(after, "white") + queens(after, "black") <
            queens(before, "white") + queens(before, "black")
        )
            return steps[i].san;
    }
    return undefined;
}

export type Futures = {
    /** What the played move allows, for "It …" */
    cost?: string;
    /** What the better move does, for "Better was …: it …" */
    gain?: string;
};

/**
 * The played move's cost and the better move's gain for `side` (to move in `fenBefore`), from
 * the engine's answer line `replyPv` (from the position after the played move `uci`) and its
 * better line `bestPv` (from `fenBefore`, the better move first).
 */
export function compareFutures(
    fenBefore: string,
    uci: string,
    replyPv: string[] | undefined,
    bestPv: string[] | undefined,
): Futures {
    const start = positionOf(fenBefore);
    if (!start) return {};
    const side = start.turn;
    const them = opposite(side);
    const played = walk(fenBefore, [uci, ...(replyPv ?? [])]);
    const better = bestPv?.length ? walk(fenBefore, bestPv) : [];
    const out: Futures = {};

    // the queens off while their king is in the centre, and the better line keeps them on
    if (kingInCentre(start, them) && played.length > 2 && better.length > 2) {
        const trade = queenTrade(played.slice(1));
        const keeps =
            queens(better.at(-1)!.pos, side) > 0 &&
            queens(better.at(-1)!.pos, them) > 0;
        if (trade && keeps) {
            out.cost = `lets ${SIDE[them]} trade queens (${trade}) while ${SIDE[them]}'s king is still in the centre`;
            out.gain = `keeps the queens on against ${SIDE[them]}'s king in the centre`;
        }
    }

    // a file opens with their king on it: no pawn left on the king's file within the line
    if (!out.gain && better.length > 2) {
        const king = start.board.kingOf(them);
        const file = king === undefined ? undefined : squareFile(king);
        if (
            file !== undefined &&
            kingInCentre(start, them) &&
            pawnOn(start, file)
        ) {
            const opened = better.find(
                (s) =>
                    !pawnOn(s.pos, file) &&
                    kingInCentre(s.pos, them) &&
                    s.pos.board.kingOf(them) === king,
            );
            if (opened)
                out.gain = `opens the ${FILES[file]}-file while ${SIDE[them]}'s king is still on it`;
        }
    }
    return out;
}
