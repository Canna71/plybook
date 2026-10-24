// Facts about a position that explain a move without an engine: hanging pieces, pins against
// the king, forks and check. Computed from attacks only (no exchanges, no x-rays).

import {
    Chess,
    Color,
    makeSquare,
    opposite,
    Piece,
    Position,
    Role,
    Square,
    SquareSet,
} from "chessops";
import { attacks, between } from "chessops/attacks";
import { parseFen } from "chessops/fen";

export type Fact = {
    kind: "check" | "hanging" | "pinned" | "fork";
    /** The side the fact is bad for */
    victim: Color;
    /** Identifies the fact, to tell which ones a move created */
    key: string;
    text: string;
    /** About a pawn: worth showing only when a move just caused it */
    minor?: boolean;
};

const VALUES: Record<Role, number> = {
    pawn: 1,
    knight: 3,
    bishop: 3,
    rook: 5,
    queen: 9,
    king: 100,
};
const SIDE = { white: "White", black: "Black" };

const describe = (piece: Piece, square: Square) =>
    `${SIDE[piece.color]}'s ${piece.role} on ${makeSquare(square)}`;

/** Squares of `color`'s pieces that attack `square`. */
function attackersOf(pos: Position, square: Square, color: Color): Square[] {
    const occupied = pos.board.occupied;
    const result: Square[] = [];
    for (const from of pos.board[color]) {
        if (attacks(pos.board.get(from)!, from, occupied).has(square)) {
            result.push(from);
        }
    }
    return result;
}

const cheapest = (pos: Position, squares: Square[]) =>
    Math.min(...squares.map((s) => VALUES[pos.board.get(s)!.role]));

/** Attacked and undefended, or attacked by something cheaper. */
function isHanging(pos: Position, square: Square): boolean {
    const piece = pos.board.get(square);
    if (!piece || piece.role === "king") return false;
    const attackers = attackersOf(pos, square, opposite(piece.color));
    if (attackers.length === 0) return false;
    const defended = attackersOf(pos, square, piece.color).length > 0;
    return !defended || cheapest(pos, attackers) < VALUES[piece.role];
}

function hanging(pos: Position): Fact[] {
    const facts: Fact[] = [];
    for (const square of pos.board.occupied) {
        if (!isHanging(pos, square)) continue;
        const piece = pos.board.get(square)!;
        const defended = attackersOf(pos, square, piece.color).length > 0;
        facts.push({
            kind: "hanging",
            victim: piece.color,
            key: `hanging:${makeSquare(square)}`,
            minor: piece.role === "pawn",
            text: `${describe(piece, square)} ${defended ? "is attacked by a cheaper piece" : "is attacked and not defended"}`,
        });
    }
    return facts;
}

/** Pieces that cannot move off the line between an enemy slider and their own king. */
function pins(pos: Position): Fact[] {
    const facts: Fact[] = [];
    for (const color of ["white", "black"] as Color[]) {
        const king = pos.board.kingOf(color);
        if (king === undefined) continue;
        for (const from of pos.board[opposite(color)]) {
            const slider = pos.board.get(from)!;
            if (!["bishop", "rook", "queen"].includes(slider.role)) continue;
            if (!attacks(slider, from, SquareSet.empty()).has(king)) continue;
            const blockers = between(from, king).intersect(pos.board.occupied);
            const pinned = blockers.singleSquare();
            if (pinned === undefined || !pos.board[color].has(pinned)) continue;
            const piece = pos.board.get(pinned)!;
            facts.push({
                kind: "pinned",
                victim: color,
                key: `pinned:${makeSquare(pinned)}`,
                minor: piece.role === "pawn",
                text: `${describe(piece, pinned)} is pinned to its king by the ${slider.role} on ${makeSquare(from)}`,
            });
        }
    }
    return facts;
}

/** A piece attacking two or more targets worth attacking: the king, something more valuable,
 * or something undefended. */
function forks(pos: Position): Fact[] {
    const facts: Fact[] = [];
    const occupied = pos.board.occupied;
    for (const from of occupied) {
        const piece = pos.board.get(from)!;
        if (piece.role === "king") continue;
        const enemy = opposite(piece.color);
        const targets = [
            ...attacks(piece, from, occupied).intersect(pos.board[enemy]),
        ]
            .filter((sq) => {
                const target = pos.board.get(sq)!;
                return (
                    target.role === "king" ||
                    VALUES[target.role] > VALUES[piece.role] ||
                    attackersOf(pos, sq, enemy).length === 0
                );
            })
            .filter((sq) => pos.board.get(sq)!.role !== "pawn");
        if (targets.length < 2) continue;
        const names = targets
            .map((sq) => pos.board.get(sq)!)
            .sort((a, b) => VALUES[b.role] - VALUES[a.role])
            .map((t) => t.role);
        facts.push({
            kind: "fork",
            victim: enemy,
            key: `fork:${makeSquare(from)}`,
            text: `${describe(piece, from)} attacks the ${names.slice(0, -1).join(", ")} and the ${names.at(-1)}`,
        });
    }
    return facts;
}

export function positionFacts(pos: Position): Fact[] {
    const facts: Fact[] = [];
    if (pos.isCheck()) {
        facts.push({
            kind: "check",
            victim: pos.turn,
            key: "check",
            text: `${SIDE[pos.turn]} is in check`,
        });
    }
    return [...facts, ...forks(pos), ...pins(pos), ...hanging(pos)];
}

export function factsFromFen(fen: string): Fact[] {
    const setup = parseFen(fen);
    const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    return pos?.isOk ? positionFacts(pos.value) : [];
}

/** The facts of `after`, marking the ones the move created. */
export function factsAfterMove(beforeFen: string, afterFen: string) {
    const before = new Set(factsFromFen(beforeFen).map((f) => f.key));
    return factsFromFen(afterFen).map((fact) => ({
        ...fact,
        isNew: !before.has(fact.key),
    }));
}

/** What to show: everything the move created first, then lasting facts about pieces. */
export const factsToShow = (facts: ReturnType<typeof factsAfterMove>) => [
    ...facts.filter((f) => f.isNew),
    ...facts.filter((f) => !f.isNew && !f.minor),
];
