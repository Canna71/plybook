// The two futures of a mistake (F.37c, docs/EXPLANATIONS.md): where the engine's answer to the
// played move leads, against where its better move leads, compared on what a coach would name
// when no material is won. Readings of the position, so interpretations in the evidence.
//
// - The queens come off while the opponent's king is still in the centre: the played move lets
//   them be traded, the better one keeps them on (9.Re1 Qb6, 12.e5 Qxe3 in the owner's games).
// - A file opens with the opponent's king on it: the better line clears the pawns from the file
//   of the king still in the centre (9.e5 dxe5 Qxe5+).
// - The better move defends what the answer's line wins: a piece of ours taken and not taken
//   back, the line ending ahead for them, that the better move guards once more.
// - Doubled pawns: the answer's line doubles ours on a file, the better one does not
//   (10…d5 … Nxb6 cxb6).

import {
    Chess,
    Color,
    makeSquare,
    opposite,
    parseUci,
    Piece,
    Position,
    Role,
    Square,
    squareFile,
} from "chessops";
import { attacks } from "chessops/attacks";
import { parseFen } from "chessops/fen";
import { makeSan } from "chessops/san";

/** Plies of a line read, extended while captures go on, as lineOutcome reads them */
const PLIES = 6;
const MAX_PLIES = 10;
/** Plies read for what a line wins or does to the pawns, which may come later */
const LONG_PLIES = 12;

const SIDE = { white: "White", black: "Black" };
const FILES = "abcdefgh";

const positionOf = (fen: string) => {
    const setup = parseFen(fen);
    const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    return pos?.isOk ? pos.value : undefined;
};

type Step = {
    pos: Position;
    san?: string;
    /** What the move took: its square and the piece, by the side that moved */
    took?: { square: Square; piece: Piece; by: Color };
};

/**
 * The positions along a line from `fen`, the start first, with each move's SAN: `plies` moves,
 * extended while captures go on, `max` at most.
 */
function walk(fen: string, pv: string[], plies = PLIES, max = MAX_PLIES) {
    const pos = positionOf(fen);
    if (!pos) return [];
    const steps: Step[] = [{ pos: pos.clone() }];
    for (const uci of pv) {
        const move = parseUci(uci);
        if (!move || !pos.isLegal(move)) break;
        const victim = "from" in move ? pos.board.get(move.to) : undefined;
        if (steps.length > plies && !victim) break;
        const by = pos.turn;
        const san = makeSan(pos, move);
        pos.play(move);
        steps.push({
            pos: pos.clone(),
            san,
            took: victim && { square: move.to, piece: victim, by },
        });
        if (steps.length > max) break;
    }
    return steps;
}

/** How many of `color`'s pieces guard `square`. */
function defenders(pos: Position, square: Square, color: Color): number {
    let n = 0;
    for (const from of pos.board[color]) {
        if (from === square) continue;
        const piece = pos.board.get(from)!;
        if (attacks(piece, from, pos.board.occupied).has(square)) n++;
    }
    return n;
}

/** Files where `color` has two pawns or more. */
function doubledFiles(pos: Position, color: Color): Set<number> {
    const count = new Map<number, number>();
    for (const sq of pos.board.pieces(color, "pawn"))
        count.set(squareFile(sq), (count.get(squareFile(sq)) ?? 0) + 1);
    return new Set([...count].filter(([, n]) => n > 1).map(([f]) => f));
}

const VALUE: Record<Role, number> = {
    pawn: 1,
    knight: 3,
    bishop: 3,
    rook: 5,
    queen: 9,
    king: 0,
};

const material = (pos: Position, color: Color) => {
    let total = 0;
    for (const sq of pos.board[color]) total += VALUE[pos.board.get(sq)!.role];
    return total;
};

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

    const longPlayed = walk(
        fenBefore,
        [uci, ...(replyPv ?? [])],
        LONG_PLIES,
        LONG_PLIES,
    );
    const longBetter = bestPv?.length
        ? walk(fenBefore, bestPv, LONG_PLIES, LONG_PLIES)
        : [];
    const playedSan = longPlayed[1]?.san;

    // what the answer's line wins, and the better move defends: a piece of ours taken there,
    // not taken back on its square, the line ending with them ahead (11…dxe4 … Bxe5, where Bd6
    // guards e5)
    const end = longPlayed.at(-1)?.pos;
    const won =
        end &&
        material(end, them) - material(end, side) >
            material(start, them) - material(start, side);
    if (!out.gain && won && longBetter.length > 1) {
        const lost = longPlayed.findIndex(
            (s, i) =>
                s.took?.by === them &&
                start.board.get(s.took.square)?.role === s.took.piece.role &&
                start.board.get(s.took.square)?.color === side &&
                longPlayed[i + 1]?.took?.square !== s.took.square,
        );
        const took = longPlayed[lost]?.took;
        const afterBest = longBetter[1].pos;
        if (
            took &&
            afterBest.board.get(took.square)?.role === took.piece.role &&
            afterBest.board.get(took.square)?.color === side &&
            defenders(afterBest, took.square, side) >
                defenders(start, took.square, side)
        )
            out.gain = `defends the ${took.piece.role} on ${makeSquare(took.square)}, which ${SIDE[them]} wins after ${playedSan} (${longPlayed[lost].san})`;
    }

    // a pawn weakness of ours the answer's line makes and the better one does not: doubled pawns
    // (10…d5 … Nxb6 cxb6)
    if (!out.cost && longPlayed.length > 2) {
        const before = doubledFiles(start, side);
        const kept = longBetter.length
            ? doubledFiles(longBetter.at(-1)!.pos, side)
            : new Set<number>();
        for (let i = 2; i < longPlayed.length && !out.cost; i++) {
            const now = doubledFiles(longPlayed[i].pos, side);
            const file = [...now].find(
                (f) =>
                    !before.has(f) &&
                    !kept.has(f) &&
                    !doubledFiles(longPlayed[i - 1].pos, side).has(f),
            );
            if (file !== undefined && doubledFiles(end!, side).has(file))
                out.cost = `lets ${SIDE[them]} double ${SIDE[side]}'s pawns on the ${FILES[file]}-file (${longPlayed[i - 1].san} ${longPlayed[i].san})`;
        }
    }
    return out;
}
