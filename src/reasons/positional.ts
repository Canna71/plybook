// Positional reasons (P2.8 R3, docs/REASONS.md): what a move does when there is no tactic or
// threat to name. Compares the board before and after the move, from the mover's side:
// development, castling, the centre, rooks on open files, passed pawns, outposts, piece
// activity, the king's pawn shield, pawn weaknesses. No engine: pure rules, for tests.

import {
    Chess,
    Color,
    makeSquare,
    opposite,
    parseSquare,
    parseUci,
    Position,
    Role,
    Square,
    SquareSet,
} from "chessops";
import { attacks } from "chessops/attacks";
import { parseFen } from "chessops/fen";
import type { PieceValues } from "../engine/piecevalues";

/** Stockfish's piece values before and after the move (engine/piecevalues.ts), when known */
export type MoveValues = { before?: PieceValues; after?: PieceValues };

/** A change in a piece's value worth saying: this share of its usual value (a knight 0.6) */
const VALUE_CHANGE = 0.15;
/**
 * The pieces whose value is worth a word, and their usual NNUE value (about what Stockfish
 * gives them in the opening), to find a side's worst piece for what it is. The queen is
 * measured but never called the worst piece: that is a coach's word for minor pieces and rooks.
 */
const NOMINAL: Partial<Record<Role, number>> = {
    knight: 4,
    bishop: 4.3,
    rook: 5.3,
    queen: 9,
};
const fmt = (v: number) => v.toFixed(1);

export type PositionalKind =
    | "develops"
    | "castles"
    | "centre"
    | "openFile"
    | "passedPawn"
    | "outpost"
    | "activates"
    | "pieceValue"
    | "badBishop"
    | "weakensKing"
    | "isolatedPawn";

export type PositionalReason = {
    kind: PositionalKind;
    /** Good for the side that moved */
    good: boolean;
    /** A verb phrase for "It …": "develops the knight", "weakens the king's pawn shield" */
    text: string;
};

const positionOf = (fen: string): Position | undefined => {
    const setup = parseFen(fen);
    const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    return pos?.isOk ? pos.value : undefined;
};

const file = (sq: Square) => sq & 7;
const rank = (sq: Square) => sq >> 3;
const FILES = "abcdefgh";
/** Rank counted from the side's own back rank: 0 to 7 */
const relRank = (sq: Square, color: Color) =>
    color === "white" ? rank(sq) : 7 - rank(sq);

const pawnsOf = (pos: Position, color: Color) =>
    pos.board.pawn.intersect(pos.board[color]);

const onFile = (set: SquareSet, f: number) =>
    [...set].filter((sq) => file(sq) === f);

/** No pawns of the other side ahead of it on its file or the files beside. */
function isPassed(pos: Position, sq: Square, color: Color): boolean {
    const theirs = pawnsOf(pos, opposite(color));
    return ![...theirs].some(
        (p) =>
            Math.abs(file(p) - file(sq)) <= 1 &&
            relRank(p, color) > relRank(sq, color),
    );
}

/** No pawn of its side on the files beside it. */
const isIsolated = (pos: Position, sq: Square, color: Color) =>
    ![...pawnsOf(pos, color)].some((p) => Math.abs(file(p) - file(sq)) === 1);

/** Squares a piece controls (attacks), excluding its own pieces' squares. */
const reach = (pos: Position, sq: Square) => {
    const piece = pos.board.get(sq)!;
    return attacks(piece, sq, pos.board.occupied).diff(pos.board[piece.color]);
};

/** No pawn of the other side can ever attack it (none on the files beside, behind it). */
function safeFromPawns(pos: Position, sq: Square, color: Color): boolean {
    const theirs = pawnsOf(pos, opposite(color));
    return ![...theirs].some(
        (p) =>
            Math.abs(file(p) - file(sq)) === 1 &&
            relRank(p, color) > relRank(sq, color),
    );
}

const HOME: Record<Color, Record<string, Role>> = {
    white: { b1: "knight", g1: "knight", c1: "bishop", f1: "bishop" },
    black: { b8: "knight", g8: "knight", c8: "bishop", f8: "bishop" },
};
const CENTRE = ["d4", "e4", "d5", "e5"].map((s) => parseSquare(s)!);

/** The positional reasons of `uci` in `fen`, good ones first. Empty if illegal. */
export function positionalReasons(
    fen: string,
    uci: string,
    values?: MoveValues,
): PositionalReason[] {
    const before = positionOf(fen);
    const move = parseUci(uci);
    if (!before || !move || !("from" in move) || !before.isLegal(move))
        return [];
    const after = before.clone();
    after.play(move);
    const me = before.turn;
    const them = opposite(me);
    const piece = before.board.get(move.from)!;
    const reasons: PositionalReason[] = [];
    const add = (kind: PositionalKind, good: boolean, text: string) =>
        reasons.push({ kind, good, text });
    const opening = before.fullmoves <= 15;
    // a capture trades or wins material: its point is not the centre or activity
    const capture =
        before.board.has(move.to) ||
        (piece.role === "pawn" && file(move.from) !== file(move.to));
    // where the piece is now (castling moves the king to the c or g file)
    const castles =
        piece.role === "king" && Math.abs(file(move.from) - file(move.to)) > 1;
    const to = castles ? (after.board.kingOf(me) ?? move.to) : move.to;

    // development and castling
    if (castles) {
        add(
            "castles",
            true,
            "castles: the king is safer and a rook comes into play",
        );
    } else if (opening && HOME[me][makeSquare(move.from)] === piece.role) {
        add("develops", true, `develops the ${piece.role}`);
    }

    // the centre, early: a pawn on d4, e4 (d5, e5)
    if (
        opening &&
        !capture &&
        piece.role === "pawn" &&
        CENTRE.includes(move.to)
    ) {
        add("centre", true, "takes a share of the centre");
    }

    // a rook to an open file (no pawns) or a half-open one (none of ours)
    if (piece.role === "rook" || (piece.role === "queen" && !opening)) {
        const f = file(to);
        const ours = onFile(pawnsOf(after, me), f).length;
        const theirs = onFile(pawnsOf(after, them), f).length;
        const fromFile = file(move.from) === f;
        if (!fromFile && ours === 0) {
            add(
                "openFile",
                true,
                `puts the ${piece.role} on the ${theirs === 0 ? "open" : "half-open"} ${FILES[f]}-file`,
            );
        }
    }

    // passed pawns: made by this move, or pushed
    if (piece.role === "pawn") {
        const wasPassed = isPassed(before, move.from, me);
        if (isPassed(after, move.to, me)) {
            add(
                "passedPawn",
                true,
                wasPassed
                    ? `pushes the passed pawn to ${makeSquare(move.to)}`
                    : `creates a passed pawn on ${makeSquare(move.to)}`,
            );
        }
    } else {
        // a capture can make a passed pawn of ours (taking the pawn that stopped it)
        const madePassed = [...pawnsOf(after, me)].find(
            (p) => isPassed(after, p, me) && !isPassed(before, p, me),
        );
        if (madePassed !== undefined) {
            add(
                "passedPawn",
                true,
                `gives a passed pawn on ${makeSquare(madePassed)}`,
            );
        }
    }

    // an outpost: a knight (or bishop) in the other half, defended by a pawn, safe from pawns
    if (
        (piece.role === "knight" || piece.role === "bishop") &&
        relRank(to, me) >= 3 &&
        relRank(to, me) <= 5 &&
        !after
            .kingAttackers(to, me, after.board.occupied)
            .intersect(after.board.pawn)
            .isEmpty() &&
        safeFromPawns(after, to, me)
    ) {
        add(
            "outpost",
            true,
            `puts the ${piece.role} on an outpost on ${makeSquare(to)}`,
        );
    }

    // activity: a long-range piece that controls many more squares (not a queen out early,
    // which gets chased; not a rook already said to be on an open file)
    const saidFile = reasons.some((r) => r.kind === "openFile");
    if (
        !castles &&
        !capture &&
        !saidFile &&
        (piece.role === "bishop" ||
            piece.role === "rook" ||
            (piece.role === "queen" && !opening))
    ) {
        const gain = reach(after, to).size() - reach(before, move.from).size();
        if (gain >= 4) {
            add(
                "activates",
                true,
                `activates the ${piece.role}: it now controls ${reach(after, to).size()} squares`,
            );
        }
    }

    // the king's pawn shield: a pawn in front of our castled king moves, while the opponent
    // still has a queen to attack it with (in an endgame the king wants out anyway)
    const king = before.board.kingOf(me);
    const theyHaveQueen = !before.board.queen
        .intersect(before.board[them])
        .isEmpty();
    if (
        theyHaveQueen &&
        piece.role === "pawn" &&
        king !== undefined &&
        relRank(king, me) === 0 &&
        (file(king) >= 5 || file(king) <= 2) &&
        Math.abs(file(move.from) - file(king)) <= 1 &&
        relRank(move.from, me) === 1 &&
        !opening
    ) {
        add("weakensKing", false, "weakens the pawns in front of the king");
    }

    // isolated pawns made by the move: ours (bad) and theirs (good, by taking a neighbour).
    // Doubled pawns are left out: a move only doubles its own pawns, by a capture that is
    // usually a fair trade, and the opponent's only when they take back.
    for (const [color, good] of [
        [me, false],
        [them, true],
    ] as const) {
        // a pawn that moved is compared with where it came from
        const origin = (p: Square) =>
            color === me && piece.role === "pawn" && p === move.to
                ? move.from
                : p;
        const newIsolated = [...pawnsOf(after, color)].find(
            (p) =>
                isIsolated(after, p, color) &&
                !(
                    pawnsOf(before, color).has(origin(p)) &&
                    isIsolated(before, origin(p), color)
                ),
        );
        if (newIsolated !== undefined) {
            const sq = makeSquare(newIsolated);
            add(
                "isolatedPawn",
                good,
                color === me
                    ? `isolates its own pawn on ${sq}`
                    : `leaves the opponent an isolated pawn on ${sq}`,
            );
        }
    }

    // the bad bishop: own pawns fixed on its colour (docs/REASONS.md). Bishops are told apart
    // by the colour of their squares, so a bishop that moves is still the same bishop
    const badBefore = badBishops(before);
    const badAfter = badBishops(after);
    const myBishopTaken =
        piece.role === "bishop" &&
        badBefore.get(`${me} ${colourOf(move.from)}`);
    const takenRole = before.board.get(move.to)?.role;
    if (
        myBishopTaken &&
        capture &&
        (takenRole === "knight" || takenRole === "bishop") &&
        !engineSaysGood(before, me, colourOf(move.from), values?.before)
    ) {
        add(
            "badBishop",
            true,
            `trades off its bad bishop (its pawns on ${joinSquares(myBishopTaken)} are fixed on the bishop's colour)`,
        );
    }
    for (const [key, pawns] of badAfter) {
        if (badBefore.has(key)) continue;
        const [color, colour] = key.split(" ");
        if (engineSaysGood(after, color, colour, values?.after)) continue;
        add(
            "badBishop",
            color !== me,
            color === me
                ? `makes its ${colour}-squared bishop bad: its pawns on ${joinSquares(pawns)} are fixed on the bishop's colour`
                : `leaves the opponent a bad ${colour}-squared bishop: its pawns on ${joinSquares(pawns)} are fixed on the bishop's colour`,
        );
    }
    for (const [key, pawns] of badBefore) {
        const [color, colour] = key.split(" ");
        // freed by the pawns, not by trading the bishop off
        const stillThere = [
            ...after.board.bishop.intersect(after.board[me]),
        ].some((b) => colourOf(b) === colour);
        if (color !== me || badAfter.has(key) || !stillThere) continue;
        if (engineSaysGood(before, color, colour, values?.before)) continue;
        // a capture by the bad bishop is a trade (said above), not a way out
        const moved = piece.role === "bishop" && colourOf(move.from) === colour;
        if (moved && capture) continue;
        add(
            "badBishop",
            true,
            piece.role === "bishop" && colourOf(move.from) === colour
                ? `brings its bad ${colour}-squared bishop out from behind its pawns on ${joinSquares(pawns)}`
                : `frees its ${colour}-squared bishop: its pawns on ${joinSquares(pawns)} no longer all hem it in`,
        );
    }

    // Stockfish's measure of the moved piece, where it was and where it is: a piece (not a
    // pawn or the king) that is worth clearly more or less there. It says better than the
    // count of squares whether the piece is active, so it replaces "activates".
    // not for a capture: a piece about to be taken back is worth little where it stands
    const valued = capture
        ? undefined
        : pieceValueReason(before, move.from, to, me, values);
    if (valued) {
        const kept = reasons.filter((r) => r.kind !== "activates");
        reasons.length = 0;
        reasons.push(...kept, valued);
    }

    return [
        ...reasons.filter((r) => r.good),
        ...reasons.filter((r) => !r.good),
    ];
}

/** "light" or "dark": the colour of a square (a1 is dark) */
export const colourOf = (sq: Square) =>
    (file(sq) + rank(sq)) % 2 === 1 ? "light" : "dark";

const joinSquares = (squares: Square[]) => {
    const names = squares.map(makeSquare);
    return names.length <= 1
        ? (names[0] ?? "")
        : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
};

/** Fixed pawns on a bishop's colour that make it bad: at least this many */
const BAD_BISHOP_PAWNS = 2;
/** A bad bishop has at most this many squares to go to */
const BAD_BISHOP_MOVES = 3;

/**
 * The bad bishops in `pos`, by "<side> <colour>", with the pawns that make them bad: pawns of
 * the bishop's side on its colour, on the b to g files, fixed (an enemy pawn right in front),
 * which block it and cannot move out of its way; the bishop behind them, with few squares to
 * go to. Measured against Stockfish's piece values (docs/REASONS.md): with "behind" and
 * "few squares" the bad bishop is worth less than its partner in about 70% of positions, from
 * 52-58% for fixed pawns alone. A bishop outside its pawns is "bad but active": not called bad.
 */
export function badBishops(pos: Position): Map<string, Square[]> {
    const bad = new Map<string, Square[]>();
    for (const color of ["white", "black"] as Color[]) {
        const enemyPawns = pawnsOf(pos, opposite(color));
        const ahead = color === "white" ? 8 : -8;
        for (const bishop of pos.board.bishop.intersect(pos.board[color])) {
            const colour = colourOf(bishop);
            const fixed = [...pawnsOf(pos, color)].filter(
                (p) =>
                    colourOf(p) === colour &&
                    file(p) >= 1 &&
                    file(p) <= 6 &&
                    enemyPawns.has(p + ahead),
            );
            if (fixed.length < BAD_BISHOP_PAWNS) continue;
            const behind = fixed.every(
                (p) => relRank(bishop, color) < relRank(p, color),
            );
            const moves = attacks(
                { role: "bishop", color },
                bishop,
                pos.board.occupied,
            )
                .diff(pos.board[color])
                .size();
            if (behind && moves <= BAD_BISHOP_MOVES)
                bad.set(`${color} ${colour}`, fixed);
        }
    }
    return bad;
}

/**
 * Stockfish disagrees that the bishop of `colour` is bad (when values are known): it values it
 * at least as high as the side's other bishop, which is what the rule was measured against,
 * or, without one, at the usual worth of a bishop or more
 */
function engineSaysGood(
    pos: Position,
    color: string,
    colour: string,
    values: PieceValues | undefined,
): boolean {
    if (!values) return false;
    const sign = color === "white" ? 1 : -1;
    const bishops = [...pos.board.bishop.intersect(pos.board[color as Color])];
    const worth = (sq: Square | undefined) => {
        const v = sq !== undefined ? values.get(makeSquare(sq)) : undefined;
        return v !== undefined ? sign * v : undefined;
    };
    const value = worth(bishops.find((b) => colourOf(b) === colour));
    if (value === undefined) return false;
    const partner = worth(bishops.find((b) => colourOf(b) !== colour));
    return value >= (partner ?? NOMINAL.bishop!);
}

function pieceValueReason(
    before: Position,
    from: Square,
    to: Square,
    me: Color,
    values: MoveValues | undefined,
): PositionalReason | undefined {
    const piece = before.board.get(from);
    if (!piece || !NOMINAL[piece.role] || !values?.before || !values.after)
        return undefined;
    const sign = me === "white" ? 1 : -1;
    const was = values.before.get(makeSquare(from));
    const now = values.after.get(makeSquare(to));
    if (was === undefined || now === undefined) return undefined;
    // the values also move with whose turn it is and with the whole position: the side's other
    // pieces, where they stand, set the scale (after 1.e4 e5 2.Na3 all of White's pieces rise
    // about 7%, the knight with them: it is not better on a3)
    let sum0 = 0;
    let sum1 = 0;
    for (const sq of before.board[me]) {
        const role = before.board.get(sq)!.role;
        if (sq === from || !NOMINAL[role]) continue;
        const b = values.before.get(makeSquare(sq));
        const a = values.after.get(makeSquare(sq));
        if (b === undefined || a === undefined) continue;
        sum0 += sign * b;
        sum1 += sign * a;
    }
    const scale = sum0 > 0 && sum1 > 0 ? sum1 / sum0 : 1;
    const v0 = sign * was;
    const v1 = (sign * now) / scale;
    const name = piece.role;
    const change = Math.abs(v1 - v0);
    const measure = `Stockfish's piece values put it ${fmt(change)} ${v1 > v0 ? "higher" : "lower"} on ${makeSquare(to)} than on ${makeSquare(from)}`;
    const enough = VALUE_CHANGE * NOMINAL[piece.role]!;
    if (v1 - v0 >= enough) {
        // the side's worst piece for what it is, before the move
        const mine = [...before.board[me]].filter((sq) => {
            const role = before.board.get(sq)!.role;
            return NOMINAL[role] && role !== "queen";
        });
        const ratio = (sq: Square) =>
            (sign * (values.before!.get(makeSquare(sq)) ?? Infinity)) /
            NOMINAL[before.board.get(sq)!.role]!;
        const worst =
            piece.role !== "queen" &&
            mine.length > 1 &&
            mine.every((sq) => sq === from || ratio(sq) >= ratio(from));
        return {
            kind: "pieceValue",
            good: true,
            text: `${worst ? "improves its worst piece, the" : "improves the"} ${name}: ${measure}`,
        };
    }
    if (v0 - v1 >= enough) {
        return {
            kind: "pieceValue",
            good: false,
            text: `puts the ${name} on a worse square: ${measure}`,
        };
    }
    return undefined;
}
