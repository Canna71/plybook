// Explanations in words without a language model (P2.4a): sentences built from the facts of the
// positions (facts.ts), the verdict on the move (review.ts) and engine lines (whatif.ts).
// Nothing here calculates: every claim comes from a computed fact or a played-out line.

import { Chess, Color, opposite, parseSquare, parseUci, Role } from "chessops";
import { makeFen, parseFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import { Fact, factsFromFen } from "./facts";
import { MoveClass } from "./review";
import { describeOutcome, lineOutcome } from "./whatif";
import { describeIdea, LineIdea, lineIdea } from "../reasons/threats";

export type ExplainInput = {
    /** The position before the move */
    fenBefore: string;
    /** The move to explain, in UCI */
    uci: string;
    verdict?: { class: MoveClass; loss: number };
    /** The engine's choice in fenBefore, in UCI */
    bestUci?: string;
    /** The engine's line from fenBefore, starting with the best move */
    bestPv?: string[];
    /** The engine's line after the move: the opponent's best answer first */
    replyPv?: string[];
    /** What the move stops and threatens (engine/threatsearch.ts), when searched */
    threats?: { stopped?: LineIdea; created?: LineIdea };
};

const SIDE = { white: "White", black: "Black" };

const VERDICTS: Record<MoveClass, string> = {
    best: "is the engine's choice",
    good: "is a good move",
    inaccuracy: "is an inaccuracy",
    mistake: "is a mistake",
    blunder: "is a blunder",
};

function play(fen: string, uci: string) {
    const setup = parseFen(fen);
    const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    const move = parseUci(uci);
    if (!pos?.isOk || !move || !pos.value.isLegal(move)) return undefined;
    const san = makeSan(pos.value, move);
    pos.value.play(move);
    return { san, fen: makeFen(pos.value.toSetup()) };
}

/** Facts of `after` that were not there in `before`. */
const newFacts = (before: Fact[], after: Fact[]) => {
    const keys = new Set(before.map((f) => f.key));
    return after.filter((f) => !keys.has(f.key));
};
/** Facts of `before` that `after` no longer has. */
const solvedFacts = (before: Fact[], after: Fact[]) => newFacts(after, before);

const squareOf = (fact: Fact) => fact.subject?.split(" on ")[1] ?? "";

const joinAnd = (parts: string[]) =>
    parts.length <= 1
        ? (parts[0] ?? "")
        : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;

const VALUES: Record<Role, number> = {
    pawn: 1,
    knight: 3,
    bishop: 3,
    rook: 5,
    queen: 9,
    king: 0,
};

/** The move takes something. */
function isCaptureAt(fen: string, uci: string): boolean {
    const setup = parseFen(fen);
    return setup.isOk && setup.value.board.has(parseSquare(uci.slice(2, 4))!);
}

/** A capture of something at least as valuable as the capturing piece. */
function isExchange(fen: string, uci: string): boolean {
    const setup = parseFen(fen);
    if (setup.isErr) return false;
    const board = setup.value.board;
    const mover = board.get(parseSquare(uci.slice(0, 2))!);
    const captured = board.get(parseSquare(uci.slice(2, 4))!);
    return !!mover && !!captured && VALUES[captured.role] >= VALUES[mover.role];
}

/** What a fact means for the side it is bad for, said from the side that caused it. */
function threatPhrase(fact: Fact): string | undefined {
    switch (fact.kind) {
        case "check":
            return "gives check";
        case "fork":
            return `forks ${fact.targets} with the ${fact.subject}`;
        case "pinned":
            return `pins the ${fact.subject} to its king`;
        case "hanging":
            return fact.minor
                ? undefined
                : fact.defended
                  ? `attacks the ${fact.subject} with a cheaper piece`
                  : `attacks the undefended ${fact.subject}`;
    }
}

/** A problem the move created for its own side. */
function weaknessPhrase(fact: Fact): string | undefined {
    if (fact.minor) return undefined;
    switch (fact.kind) {
        case "pinned":
            return `walks into a pin: the ${fact.subject} is pinned by the ${fact.by}`;
        case "hanging":
            return fact.defended
                ? `leaves the ${fact.subject} attacked by a cheaper piece`
                : `leaves the ${fact.subject} undefended and attacked`;
        case "fork":
            return `allows a fork of ${fact.targets} by the ${fact.subject}`;
        default:
            return undefined;
    }
}

/** A problem of the side to move that a move solved. */
function solvedPhrase(fact: Fact): string | undefined {
    switch (fact.kind) {
        case "check":
            return undefined; // every legal move gets out of check
        case "pinned":
            return fact.minor
                ? undefined
                : `breaks the pin on the ${fact.subject}`;
        case "hanging":
            return fact.minor ? undefined : `saves the ${fact.subject}`;
        case "fork":
            return `escapes the fork by the ${fact.subject}`;
    }
}

/**
 * Gains and repairs of a move for `side`, as verb phrases. `told`: squares already explained
 * by a threat ("It threatens gxh5, winning the queen"), not to be said twice.
 */
function achievements(
    before: Fact[],
    after: Fact[],
    side: Color,
    told: string[] = [],
): string[] {
    const created = newFacts(before, after).filter(
        (f) =>
            f.victim === opposite(side) &&
            !(f.kind === "hanging" && told.includes(squareOf(f))),
    );
    // a forked piece is not worth a second mention as merely attacked
    const forked = new Set(created.flatMap((f) => f.targetSquares ?? []));
    const gains = created
        .filter((f) => !(f.kind === "hanging" && forked.has(squareOf(f))))
        .map(threatPhrase);
    const repairs = solvedFacts(before, after)
        .filter((f) => f.victim === side)
        .map(solvedPhrase);
    return [...repairs, ...gains].filter((p): p is string => !!p);
}

/** "After Bxg4 Qd2: Black wins material (+9)." when a line wins material or mates. */
function consequence(fen: string, pv: string[], side: Color) {
    const outcome = lineOutcome(fen, pv, side);
    if (
        !outcome?.sans.length ||
        (!outcome.mated && outcome.materialChange === 0)
    ) {
        return undefined;
    }
    return `After ${outcome.sans.join(" ")}: ${describeOutcome(outcome)}.`;
}

/** A few sentences on why a move is good or bad. Empty if the move is not legal in fenBefore. */
export function explainMove(input: ExplainInput): string[] {
    const moved = play(input.fenBefore, input.uci);
    if (!moved) return [];
    const side: Color =
        input.fenBefore.split(" ")[1] === "b" ? "black" : "white";
    const opponent = opposite(side);
    const before = factsFromFen(input.fenBefore);
    const after = factsFromFen(moved.fen);
    const sentences: string[] = [];

    const verdict = input.verdict;
    if (verdict) {
        const loss =
            verdict.class !== "best" && verdict.class !== "good"
                ? `: it gives away ${verdict.loss.toFixed(0)}% of ${SIDE[side]}'s winning chances`
                : "";
        sentences.push(`${moved.san} ${VERDICTS[verdict.class]}${loss}.`);
    }
    const bad =
        verdict &&
        (verdict.class === "inaccuracy" ||
            verdict.class === "mistake" ||
            verdict.class === "blunder");

    // what the move does for its own side (less what its threat will say)
    const threatened = input.threats?.created?.motif?.squares ?? [];
    const done = achievements(before, after, side, threatened);
    // what it leaves behind; a capturing piece open to recapture is an exchange, not a weakness
    const exchange = isExchange(input.fenBefore, input.uci);
    const weaknesses = newFacts(before, after)
        .filter((f) => f.victim === side)
        .filter(
            (f) =>
                !(
                    exchange &&
                    f.kind === "hanging" &&
                    squareOf(f) === input.uci.slice(2, 4)
                ),
        )
        .map(weaknessPhrase)
        .filter((p): p is string => !!p);
    if (bad && weaknesses.length) {
        sentences.push(`It ${joinAnd(weaknesses)}.`);
    } else if (!bad && done.length) {
        sentences.push(`It ${joinAnd(done)}.`);
    }

    // the ideas: the threat it stops, the one it makes (the null-move searches)
    if (!bad && input.threats?.stopped) {
        sentences.push(`It stops ${describeIdea(input.threats.stopped)}.`);
    }
    if (!bad && input.threats?.created) {
        sentences.push(`It threatens ${describeIdea(input.threats.created)}.`);
    }

    // the opponent's answer and where it leads
    const reply = input.replyPv?.[0] && play(moved.fen, input.replyPv[0]);
    // what the answer does, named: a fork, a skewer… (taking back is not a free piece)
    const capturedSquare =
        isCaptureAt(input.fenBefore, input.uci) && input.uci.slice(2, 4);
    const replyIdea =
        bad && input.replyPv?.length
            ? lineIdea(moved.fen, input.replyPv, capturedSquare || undefined)
            : undefined;
    if (bad && reply) {
        if (reply.san.endsWith("#")) {
            sentences.push(
                `${SIDE[opponent]} answers ${reply.san}, checkmate.`,
            );
        } else if (replyIdea?.motif || replyIdea?.mates) {
            sentences.push(
                `${SIDE[opponent]} answers ${describeIdea(replyIdea)}.`,
            );
            const result = consequence(moved.fen, input.replyPv!, opponent);
            if (result) sentences.push(result);
        } else {
            const replyGains = newFacts(after, factsFromFen(reply.fen))
                .filter((f) => f.victim === side)
                .map(threatPhrase)
                .filter((p): p is string => !!p);
            const how = replyGains.length ? ` and ${joinAnd(replyGains)}` : "";
            sentences.push(`${SIDE[opponent]} answers ${reply.san}${how}.`);
            const result = consequence(moved.fen, input.replyPv!, opponent);
            if (result) sentences.push(result);
        }
    }

    // the better move
    if (bad && input.bestUci && input.bestUci !== input.uci) {
        const best = play(input.fenBefore, input.bestUci);
        const bestIdea =
            input.bestPv?.[0] === input.bestUci
                ? lineIdea(input.fenBefore, input.bestPv)
                : undefined;
        if (best && (bestIdea?.motif || bestIdea?.mates)) {
            // the better move's idea, named: "Better was Nxf7, a fork of …"
            sentences.push(`Better was ${describeIdea(bestIdea)}.`);
        } else if (best) {
            const bestDone = achievements(before, factsFromFen(best.fen), side);
            const why = bestDone.length ? `: it ${joinAnd(bestDone)}` : "";
            sentences.push(`Better was ${best.san}${why}.`);
            if (input.bestPv?.[0] === input.bestUci) {
                const result = consequence(input.fenBefore, input.bestPv, side);
                if (result) sentences.push(result);
            }
        }
    }
    return sentences;
}
