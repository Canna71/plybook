// Tactical motifs in a line of moves (P2.8 R1, docs/REASONS.md): what the side to move does to
// the opponent along the line: forks, pins, skewers, discovered attacks, mates by name. Each
// detector is a rule over the positions of the line; `pnpm eval:reasons` measures them against
// the themes Lichess tags its puzzles with. The ideas follow the Lichess puzzle tagger; the code
// is ours (that tagger is AGPL). No DOM, no engine: pure functions, for tests.

import {
    Chess,
    Color,
    makeSquare,
    NormalMove,
    opposite,
    parseSquare,
    parseUci,
    Role,
    Square,
    SquareSet,
} from "chessops";
import { attacks, between, ray } from "chessops/attacks";
import { parseFen } from "chessops/fen";

export type Motif =
    | "mate"
    | "backRankMate"
    | "smotheredMate"
    | "doubleCheck"
    | "fork"
    | "pin"
    | "skewer"
    | "discoveredAttack"
    | "hangingPiece"
    | "promotion";

export type Reason = {
    motif: Motif;
    /** The ply of the line where it happens (0 = the first move) */
    ply: number;
    /** The squares it is about: the acting piece first, then its targets */
    squares: string[];
};

const VALUE: Record<Role, number> = {
    pawn: 1,
    knight: 3,
    bishop: 3,
    rook: 5,
    queen: 9,
    king: 100,
};

const SLIDERS = new Set<Role>(["bishop", "rook", "queen"]);

/** One move of the line, with the positions on both sides of it. */
type Step = {
    ply: number;
    move: NormalMove;
    before: Chess;
    after: Chess;
    /** Played by the side to move at the start of the line */
    ours: boolean;
};

function playLine(fen: string, line: string[]): Step[] | undefined {
    const setup = parseFen(fen);
    if (setup.isErr) return undefined;
    const start = Chess.fromSetup(setup.value);
    if (start.isErr) return undefined;
    let pos = start.value;
    const steps: Step[] = [];
    for (const [ply, uci] of line.entries()) {
        const move = parseUci(uci);
        if (!move || !("from" in move) || !pos.isLegal(move)) break;
        const after = pos.clone();
        after.play(move);
        steps.push({ ply, move, before: pos, after, ours: ply % 2 === 0 });
        pos = after;
    }
    return steps;
}

/** `color`'s pieces attacking `square`. */
const attackersOf = (pos: Chess, square: Square, color: Color) =>
    pos.kingAttackers(square, color, pos.board.occupied);

const valueAt = (pos: Chess, square: Square) => {
    const piece = pos.board.get(square);
    return piece ? VALUE[piece.role] : 0;
};

const isCapture = (step: Step) =>
    step.before.board.has(step.move.to) ||
    (step.before.board.get(step.move.from)?.role === "pawn" &&
        step.move.from % 8 !== step.move.to % 8);

/** Our later move that captures on `square` (from ply `after` on). */
const captureLater = (steps: Step[], after: number, square: Square) =>
    steps.find(
        (s) => s.ours && s.ply > after && s.move.to === square && isCapture(s),
    );
const capturedLater = (steps: Step[], after: number, square: Square) =>
    !!captureLater(steps, after, square);

/** A capture that wins something: the piece is worth more than ours, or nobody defends it. */
const winningCapture = (s: Step) =>
    valueAt(s.before, s.move.to) > valueAt(s.before, s.move.from) ||
    attackersOf(s.before, s.move.to, opposite(s.before.turn)).isEmpty();

/** Our material minus the opponent's, `me` being the side to move at the start. */
function balance(pos: Chess, me: Color): number {
    let sum = 0;
    for (const sq of pos.board.occupied) {
        const piece = pos.board.get(sq)!;
        if (piece.role === "king") continue;
        sum += piece.color === me ? VALUE[piece.role] : -VALUE[piece.role];
    }
    return sum;
}

/** The opponent pieces on a line beyond `from` in the direction of `through`, nearest first. */
function behind(pos: Chess, from: Square, through: Square): Square[] {
    const line = ray(from, through);
    return [...line.intersect(pos.board.occupied)]
        .filter(
            (sq) =>
                sq !== from && sq !== through && between(from, sq).has(through),
        )
        .sort((a, b) => between(from, a).size() - between(from, b).size());
}

type Pin = { by: Square; pinned: Square; to: Square };

/** Pins in `pos` by `color`'s sliders: the pinning piece, the pinned one and what it shields. */
function pins(pos: Chess, color: Color): Pin[] {
    const result: Pin[] = [];
    const enemy = opposite(color);
    for (const from of pos.board[color].intersect(
        pos.board.bishop.union(pos.board.rook).union(pos.board.queen),
    )) {
        const piece = pos.board.get(from)!;
        for (const target of attacks(piece, from, pos.board.occupied).intersect(
            pos.board[enemy],
        )) {
            const next = behind(pos, from, target)[0];
            if (next === undefined || !pos.board[enemy].has(next)) continue;
            if (!attacks(piece, from, SquareSet.empty()).has(next)) continue;
            // a pawn in front of a piece is hardly pinned; in front of its king it is
            const toKing = pos.board.get(next)!.role === "king";
            if (!toKing && pos.board.get(target)!.role === "pawn") continue;
            // a king in front is in check or x-rayed, not pinned
            if (pos.board.get(target)!.role === "king") continue;
            if (valueAt(pos, next) > valueAt(pos, target)) {
                result.push({ by: from, pinned: target, to: next });
            }
        }
    }
    return result;
}

// #region detectors, each over our moves of the line

function forks(steps: Step[]): Reason[] {
    const result: Reason[] = [];
    for (const s of steps.filter((s) => s.ours)) {
        const pos = s.after;
        const mover = pos.board.get(s.move.to)!;
        const enemy = opposite(mover.color);
        const targets = [
            ...attacks(mover, s.move.to, pos.board.occupied).intersect(
                pos.board[enemy],
            ),
        ].filter((sq) => {
            const role = pos.board.get(sq)!.role;
            if (role === "pawn") return false;
            return (
                role === "king" ||
                VALUE[role] > VALUE[mover.role] ||
                attackersOf(pos, sq, enemy).isEmpty()
            );
        });
        // and the line cashes in on it: one of the targets is taken later
        if (
            targets.length >= 2 &&
            targets.some((t) => capturedLater(steps, s.ply, t))
        ) {
            result.push({
                motif: "fork",
                ply: s.ply,
                squares: [s.move.to, ...targets].map(makeSquare),
            });
        }
    }
    return result;
}

/**
 * We win a piece that could not move away: pinned to its king or to something worth more.
 * Taking it must gain something (it is worth more than our piece, or undefended): an even
 * trade of a pinned piece is a trade, not a pin. A pinned pawn is not the point (taking it is
 * taking a pawn), nor is a pin whose pinning piece is taken at once, a pin our move did not
 * make, or taking a piece the opponent could have unpinned and did not have to (the pin must
 * have held through their move). Measured in docs/REASONS.md.
 */
function pinned(steps: Step[]): Reason[] {
    const result: Reason[] = [];
    const last = steps.at(-1)!.ply;
    // the pinning piece is not taken at once (then the pin never mattered)
    const survives = (ply: number, by: Square) =>
        steps[ply + 1]?.move.to !== by;
    for (const s of steps.filter((s) => s.ours)) {
        const me = s.before.turn;
        const enemy = opposite(me);
        // a piece that just stepped in to block a check is won by the check, not the pin
        const blocker = steps[s.ply - 1]?.move.to;
        // the pin held through the opponent's move: they could not get out of it
        const held = new Set(
            s.ply >= 1
                ? pins(steps[s.ply - 1].before, me).map(
                      (p) => `${p.pinned}-${p.to}`,
                  )
                : [],
        );
        for (const pin of pins(s.before, me)) {
            if (pin.pinned === blocker) continue;
            if (s.before.board.get(pin.pinned)!.role === "pawn") continue;
            if (!held.has(`${pin.pinned}-${pin.to}`)) continue;
            const gains =
                valueAt(s.before, pin.pinned) >
                    valueAt(s.before, s.move.from) ||
                attackersOf(s.before, pin.pinned, enemy).isEmpty();
            if (s.move.to === pin.pinned && isCapture(s) && gains) {
                result.push({
                    motif: "pin",
                    ply: s.ply,
                    squares: [pin.by, pin.pinned, pin.to].map(makeSquare),
                });
            }
        }
        // a pin this move created, cashed in later, or the last move pinning something to its
        // king that is worth more than the pinning piece (it is lost)
        const before = new Set(
            pins(s.before, me).map((p) => `${p.pinned}-${p.to}`),
        );
        for (const pin of pins(s.after, me)) {
            if (before.has(`${pin.pinned}-${pin.to}`)) continue;
            if (s.after.board.get(pin.pinned)!.role === "pawn") continue;
            // the move makes the pin: the moved piece pins, or it moved off the line
            const made =
                pin.by === s.move.to ||
                between(pin.by, pin.pinned).has(s.move.from);
            if (!made || !survives(s.ply, pin.by)) continue;
            const wins =
                s.ply === last &&
                s.after.board.get(pin.to)?.role === "king" &&
                valueAt(s.after, pin.pinned) > valueAt(s.after, s.move.to);
            if (capturedLater(steps, s.ply, pin.pinned) || wins) {
                result.push({
                    motif: "pin",
                    ply: s.ply,
                    squares: [s.move.to, pin.pinned, pin.to].map(makeSquare),
                });
            }
        }
        // a pinned piece cannot escape: the move attacks it, and it is taken or lost
        const mover = s.after.board.get(s.move.to)!;
        const hits = attacks(mover, s.move.to, s.after.board.occupied);
        for (const pin of pins(s.after, me)) {
            if (!hits.has(pin.pinned) || pin.pinned === s.move.to) continue;
            if (s.after.board.get(pin.pinned)!.role === "pawn") continue;
            if (!survives(s.ply, pin.by)) continue;
            const worth =
                valueAt(s.after, pin.pinned) > VALUE[mover.role] ||
                attackersOf(s.after, pin.pinned, enemy).isEmpty();
            if (
                worth &&
                (capturedLater(steps, s.ply, pin.pinned) || s.ply === last)
            ) {
                result.push({
                    motif: "pin",
                    ply: s.ply,
                    squares: [s.move.to, pin.pinned, pin.to].map(makeSquare),
                });
            }
        }
        // a pinned defender cannot take back: our capture looks defended but is not
        if (isCapture(s) && !s.after.isCheckmate()) {
            const defenders = attackersOf(s.after, s.move.to, enemy);
            const retakes = [...s.after.allDests()].some(([, to]) =>
                to.has(s.move.to),
            );
            const pinnedDefenders = pins(s.after, me).filter((p) =>
                defenders.has(p.pinned),
            );
            if (!retakes && pinnedDefenders.length) {
                result.push({
                    motif: "pin",
                    ply: s.ply,
                    squares: [
                        s.move.to,
                        pinnedDefenders[0].pinned,
                        pinnedDefenders[0].to,
                    ].map(makeSquare),
                });
            }
        }
    }
    return result;
}

/** The moved slider attacks a valuable piece; when it moves, we take the one behind it. */
function skewers(steps: Step[]): Reason[] {
    const result: Reason[] = [];
    for (const s of steps.filter((s) => s.ours)) {
        const pos = s.after;
        const mover = pos.board.get(s.move.to)!;
        if (!SLIDERS.has(mover.role)) continue;
        const enemy = opposite(mover.color);
        for (const front of attacks(
            mover,
            s.move.to,
            pos.board.occupied,
        ).intersect(pos.board[enemy])) {
            const back = behind(pos, s.move.to, front)[0];
            if (back === undefined || !pos.board[enemy].has(back)) continue;
            if (!attacks(mover, s.move.to, SquareSet.empty()).has(back))
                continue;
            const frontValue = valueAt(pos, front);
            if (frontValue < VALUE.rook || frontValue <= valueAt(pos, back))
                continue;
            if (pos.board.get(back)!.role === "pawn") continue;
            // the piece behind is taken, and that wins something (not a trade)
            const taking = captureLater(steps, s.ply, back);
            if (taking && winningCapture(taking)) {
                result.push({
                    motif: "skewer",
                    ply: s.ply,
                    squares: [s.move.to, front, back].map(makeSquare),
                });
            }
        }
    }
    return result;
}

/** The moved piece uncovers another one: a check, or an attack on a piece taken later. */
function discoveries(steps: Step[]): Reason[] {
    const result: Reason[] = [];
    for (const s of steps.filter((s) => s.ours)) {
        const me = s.before.turn;
        const enemy = opposite(me);
        const pos = s.after;
        for (const from of pos.board[me].intersect(
            pos.board.bishop.union(pos.board.rook).union(pos.board.queen),
        )) {
            if (from === s.move.to) continue;
            const piece = pos.board.get(from)!;
            const now = attacks(piece, from, pos.board.occupied).intersect(
                pos.board[enemy],
            );
            const was = attacks(piece, from, s.before.board.occupied);
            for (const target of now) {
                if (was.has(target) || !between(from, target).has(s.move.from))
                    continue;
                const isKing = pos.board.get(target)!.role === "king";
                if (isKing || capturedLater(steps, s.ply, target)) {
                    result.push({
                        motif: "discoveredAttack",
                        ply: s.ply,
                        squares: [from, target].map(makeSquare),
                    });
                }
            }
        }
    }
    return result;
}

function doubleChecks(steps: Step[]): Reason[] {
    return steps
        .filter((s) => s.ours && s.after.ctx().checkers.size() >= 2)
        .map((s) => ({
            motif: "doubleCheck" as const,
            ply: s.ply,
            squares: [...s.after.ctx().checkers].map(makeSquare),
        }));
}

/**
 * The first move takes a piece (not a pawn) nobody defended, which is not just taking back
 * what the opponent's last move took, and the material stays won two moves later.
 */
function hanging(steps: Step[], lastCapture?: Square): Reason[] {
    const first = steps[0];
    if (!first?.ours) return [];
    const taken = first.before.board.get(first.move.to);
    if (!taken || taken.role === "pawn") return [];
    const me = first.before.turn;
    if (!attackersOf(first.before, first.move.to, opposite(me)).isEmpty())
        return [];
    if (lastCapture === first.move.to) return []; // a recapture
    const later = steps[2]?.after;
    if (later && balance(later, me) < balance(first.after, me)) return [];
    return [
        {
            motif: "hangingPiece",
            ply: 0,
            squares: [makeSquare(first.move.to)],
        },
    ];
}

function promotions(steps: Step[]): Reason[] {
    return steps
        .filter((s) => s.ours && s.move.promotion)
        .map((s) => ({
            motif: "promotion" as const,
            ply: s.ply,
            squares: [makeSquare(s.move.to)],
        }));
}

function mates(steps: Step[]): Reason[] {
    const last = steps.at(-1);
    if (!last?.ours || !last.after.isCheckmate()) return [];
    const pos = last.after;
    const king = pos.board.kingOf(pos.turn)!;
    const checkers = [...pos.ctx().checkers];
    const result: Reason[] = [
        {
            motif: "mate",
            ply: last.ply,
            squares: [makeSquare(last.move.to), makeSquare(king)],
        },
    ];
    const own = pos.board[pos.turn];
    const around = attacks(
        { role: "king", color: pos.turn },
        king,
        SquareSet.empty(),
    );
    const checker =
        checkers.length === 1 ? pos.board.get(checkers[0]) : undefined;
    // smothered: a knight mates a king boxed in by its own pieces
    if (checker?.role === "knight" && around.diff(own).isEmpty()) {
        result.push({ ...result[0], motif: "smotheredMate" });
    }
    // back rank: a rook or queen along the king's first rank, every square in front of the
    // king taken by its own pieces
    const home = pos.turn === "white" ? 0 : 7;
    const rank = (sq: Square) => sq >> 3;
    if (
        checker &&
        (checker.role === "rook" || checker.role === "queen") &&
        rank(king) === home &&
        rank(checkers[0]) === home
    ) {
        const forward = [...around].filter((sq) => rank(sq) !== home);
        if (forward.every((sq) => own.has(sq))) {
            result.push({ ...result[0], motif: "backRankMate" });
        }
    }
    return result;
}
// #endregion

/**
 * Every motif found in `line` (UCI moves from `fen`), for the side to move in `fen`.
 * `lastCapture`, the square where the move that led to `fen` captured (if it did), tells
 * taking back from taking a free piece.
 */
export function lineMotifs(
    fen: string,
    line: string[],
    lastCapture?: string,
): Reason[] {
    const steps = playLine(fen, line);
    if (!steps?.length) return [];
    const all = [
        ...mates(steps),
        ...doubleChecks(steps),
        ...forks(steps),
        ...pinned(steps),
        ...skewers(steps),
        ...discoveries(steps),
        ...hanging(steps, lastCapture ? parseSquare(lastCapture) : undefined),
        ...promotions(steps),
    ];
    // one reason per motif and squares (two rules may find the same pin)
    const seen = new Set<string>();
    return all.filter((r) => {
        const key = `${r.motif} ${r.squares.join(" ")}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

/**
 * The reasons that are the point of the line, most important first. A mate is the point of a
 * line that mates: the forks and checks on the way are how it gets there, not why.
 */
export function mainReasons(reasons: Reason[]): Reason[] {
    const has = (m: Motif) => reasons.some((r) => r.motif === m);
    const ORDER: Motif[] = [
        "smotheredMate",
        "backRankMate",
        "mate",
        "doubleCheck",
        "discoveredAttack",
        "skewer",
        "pin",
        "fork",
        "promotion",
        "hangingPiece",
    ];
    const onTheWay = new Set<Motif>(["fork", "pin", "hangingPiece"]);
    let kept = has("mate")
        ? reasons.filter((r) => !onTheWay.has(r.motif))
        : reasons;
    // a pin with or after another tactic is part of it: that tactic is the point
    const tactics = new Set<Motif>([
        "doubleCheck",
        "discoveredAttack",
        "skewer",
        "fork",
    ]);
    const firstTactic = Math.min(
        ...kept.filter((r) => tactics.has(r.motif)).map((r) => r.ply),
    );
    kept = kept.filter((r) => r.motif !== "pin" || r.ply < firstTactic);
    return [...kept].sort(
        (a, b) =>
            ORDER.indexOf(a.motif) - ORDER.indexOf(b.motif) || a.ply - b.ply,
    );
}
