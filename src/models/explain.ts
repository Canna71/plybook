// Explanations in words without a language model (P2.4a): sentences built from the facts of the
// positions (facts.ts), the verdict on the move (review.ts) and engine lines (whatif.ts).
// Nothing here calculates: every claim comes from a computed fact or a played-out line.

import { Chess, Color, opposite, parseSquare, parseUci, Role } from "chessops";
import { makeFen, parseFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import { Evaluation } from "chessops/pgn";
import { Fact, factsFromFen } from "./facts";
import { MoveClass } from "./review";
import { describeOutcome, lineOutcome } from "./whatif";
import { describeIdea, LineIdea, lineIdea } from "../reasons/threats";
import { MoveValues, positionalReasons } from "../reasons/positional";

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
    /** Stockfish's piece values before and after the move, when the engine is Stockfish */
    values?: MoveValues;
    /** The engine's evaluations of the positions before and after the move, from White's side */
    evaluations?: { before?: Evaluation; after?: Evaluation };
    /**
     * The game's positions before `fenBefore`, oldest first, when the move is in a game: a
     * FEN alone does not show repetitions
     */
    history?: string[];
};

// #region the structured result (docs/EXPLANATIONS.md)

/** A score for the side that moved: centipawns, or mate in N (positive: that side mates) */
export type MoverScore =
    | { type: "cp"; value: number }
    | { type: "mate"; value: number };

export type LineLabel = "reply" | "best";

/** An engine line as shown: replayed from its position, cut at the first illegal move */
export type EvidenceLine = {
    label: LineLabel;
    /** The position the line starts from */
    fen: string;
    uci: string[];
    san: string[];
    /** Moves left out because they were not legal there (a line from another position) */
    dropped: number;
};

/**
 * How a claim is known: a fact of the position on the board; an engine line played out (the
 * line is in `lines`, or for threats the null-move search's); or a rule's reading of the
 * position, which is an interpretation, not a fact.
 */
export type Basis = "board" | "line" | "interpretation";

export type EvidenceItem = {
    text: string;
    basis: Basis;
    /** True for board facts and played-out lines; false for interpretations */
    verified: boolean;
    line?: LineLabel;
};

export type MoveExplanation = {
    fenBefore: string;
    move: { uci: string; san: string };
    /** The side that moved: every score is from its point of view */
    side: Color;
    best?: { uci: string; san: string };
    evaluation: {
        before?: MoverScore;
        after?: MoverScore;
        /** The shallower of the two searches */
        depth?: number;
        class?: MoveClass;
        /**
         * Winning chances given away, in %: the verdict compares on the winning-chance scale,
         * where mate and centipawn scores can be compared
         */
        loss?: number;
    };
    /** The opponent's strongest answer, when the engine gave one */
    reply?: { uci: string; san: string };
    lines: EvidenceLine[];
    evidence: EvidenceItem[];
    text: string[];
    /** What the analysis could not see or settle, in words */
    limits: string[];
    /** Too little analysis to judge the move: no verdict and no better move is said */
    inconclusive: boolean;
    validation: { ok: boolean; problems: string[] };
};

/** Below this depth a verdict is preliminary: said as such, not as a judgement */
export const MIN_DEPTH = 10;

const toMover = (e: Evaluation | undefined, side: Color) => {
    if (!e) return undefined;
    const sign = side === "white" ? 1 : -1;
    return "mate" in e && e.mate !== undefined
        ? ({ type: "mate", value: sign * e.mate } as MoverScore)
        : ({
              type: "cp",
              value: Math.round(sign * (e as { pawns: number }).pawns * 100),
          } as MoverScore);
};

/** The legal start of `pv` from `fen`, in UCI and SAN. */
function legalLine(fen: string, pv: string[]) {
    const setup = parseFen(fen);
    const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    const uci: string[] = [];
    const san: string[] = [];
    if (pos?.isOk) {
        for (const m of pv) {
            const move = parseUci(m);
            if (!move || !pos.value.isLegal(move)) break;
            san.push(makeSan(pos.value, move));
            pos.value.play(move);
            uci.push(m);
        }
    }
    return { uci, san, dropped: pv.length - uci.length };
}

/** A position without the move counters, to find repetitions */
const placeKey = (fen: string) => fen.split(" ").slice(0, 4).join(" ");

// #endregion

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
        // a double attack on the board; a fork only when a line wins one of them (motifs.ts)
        case "fork":
            return `attacks ${fact.targets} at once with the ${fact.subject}`;
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
            return `lets the ${fact.subject} attack ${fact.targets} at once`;
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
            return `escapes the double attack by the ${fact.subject}`;
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
export const explainMove = (input: ExplainInput): string[] =>
    explainMoveFull(input)?.text ?? [];

/**
 * Why a move is good or bad, with the evidence behind each sentence (docs/EXPLANATIONS.md).
 * Undefined if the move is not legal in fenBefore.
 */
export function explainMoveFull(
    input: ExplainInput,
): MoveExplanation | undefined {
    const moved = play(input.fenBefore, input.uci);
    if (!moved) return undefined;
    const side: Color =
        input.fenBefore.split(" ")[1] === "b" ? "black" : "white";
    const opponent = opposite(side);
    const before = factsFromFen(input.fenBefore);
    const after = factsFromFen(moved.fen);
    const sentences: string[] = [];
    const evidence: EvidenceItem[] = [];
    const limits: string[] = [];
    const problems: string[] = [];
    const lines: EvidenceLine[] = [];
    const fact = (text: string) =>
        evidence.push({ text, basis: "board", verified: true });
    const fromLine = (text: string, line?: LineLabel) =>
        evidence.push({ text, basis: "line", verified: true, line });

    // the engine's lines, replayed: only their legal start is used or shown
    const shown = (label: LineLabel, fen: string, pv?: string[]) => {
        if (!pv?.length) return undefined;
        const line = legalLine(fen, pv);
        if (line.dropped)
            problems.push(
                `${line.dropped} move${line.dropped > 1 ? "s" : ""} of the ${label === "reply" ? "answer" : "better"} line were not legal there and were left out`,
            );
        if (!line.uci.length) return undefined;
        lines.push({ label, fen, ...line });
        return line.uci;
    };
    const replyPv = shown("reply", moved.fen, input.replyPv);
    const bestPv =
        input.bestPv?.[0] === input.bestUci
            ? shown("best", input.fenBefore, input.bestPv)
            : undefined;

    // the evaluations, from the mover's side; a shallow search judges nothing yet
    const evBefore = input.evaluations?.before;
    const evAfter = input.evaluations?.after;
    const depths = [evBefore?.depth, evAfter?.depth].filter(
        (d): d is number => d !== undefined,
    );
    const depth = depths.length ? Math.min(...depths) : undefined;
    const inconclusive =
        !input.verdict || (depth !== undefined && depth < MIN_DEPTH);
    if (!input.verdict) {
        limits.push("No evaluation of both positions: the move is not judged");
    } else if (inconclusive) {
        limits.push(
            `Searched to depth ${depth} only: the verdict is preliminary`,
        );
    }

    const verdict = inconclusive ? undefined : input.verdict;
    if (verdict) {
        const loss =
            verdict.class !== "best" && verdict.class !== "good"
                ? `: it gives away ${verdict.loss.toFixed(0)}% of ${SIDE[side]}'s winning chances`
                : "";
        sentences.push(`${moved.san} ${VERDICTS[verdict.class]}${loss}.`);
    } else if (input.verdict) {
        sentences.push(
            `${moved.san}: the engine has not searched deep enough to judge it yet (depth ${depth}).`,
        );
    }
    const bad =
        verdict &&
        (verdict.class === "inaccuracy" ||
            verdict.class === "mistake" ||
            verdict.class === "blunder");

    // the game: a third repetition, which a FEN alone does not show
    if (input.history) {
        const key = placeKey(moved.fen);
        const seen = [...input.history, input.fenBefore].filter(
            (f) => placeKey(f) === key,
        ).length;
        if (seen >= 2) {
            const text =
                "repeats the position for the third time: a draw can be claimed";
            sentences.push(`It ${text}.`);
            fact(text);
        } else if (seen === 1) {
            limits.push(
                "The position after the move occurred before in this game; the engine judged it without the game, so it may not count a repetition",
            );
        }
    } else {
        limits.push("No game history: repetitions are not checked");
    }

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
        weaknesses.forEach(fact);
    } else if (!bad && done.length) {
        sentences.push(`It ${joinAnd(done)}.`);
        done.forEach(fact);
    }

    // the ideas: the threat it stops, the one it makes (the null-move searches)
    if (!bad && input.threats?.stopped) {
        const text = `stops ${describeIdea(input.threats.stopped)}`;
        sentences.push(`It ${text}.`);
        fromLine(text);
    }
    if (!bad && input.threats?.created) {
        const text = `threatens ${describeIdea(input.threats.created)}`;
        sentences.push(`It ${text}.`);
        fromLine(text);
    }

    // the positional side: development, files, pawns, the king's shelter. Rules reading the
    // position: interpretations, never stated as facts in the evidence
    const positional = positionalReasons(
        input.fenBefore,
        input.uci,
        input.values,
    );
    const interpret = (texts: string[]) =>
        texts.forEach((text) =>
            evidence.push({ text, basis: "interpretation", verified: false }),
        );
    if (!bad) {
        const good = positional.filter((r) => r.good).slice(0, 2);
        if (good.length) {
            const also = sentences.length > 1 ? "It also " : "It ";
            sentences.push(`${also}${joinAnd(good.map((r) => r.text))}.`);
            interpret(good.map((r) => r.text));
        }
    }

    // the opponent's answer and where it leads
    const reply = replyPv?.[0] ? play(moved.fen, replyPv[0]) : undefined;
    // what the answer does, named: a fork, a skewer… (taking back is not a free piece)
    const capturedSquare =
        isCaptureAt(input.fenBefore, input.uci) && input.uci.slice(2, 4);
    const replyIdea =
        bad && replyPv
            ? lineIdea(moved.fen, replyPv, capturedSquare || undefined)
            : undefined;
    // a bad move that loses nothing at once: what it costs in the position
    if (bad && !replyIdea?.motif && !replyIdea?.mates) {
        const costs = positional.filter((r) => !r.good).slice(0, 2);
        if (costs.length) {
            sentences.push(`It ${joinAnd(costs.map((r) => r.text))}.`);
            interpret(costs.map((r) => r.text));
        }
    }
    const result = (fen: string, pv: string[], who: Color, line: LineLabel) => {
        const text = consequence(fen, pv, who);
        if (!text) return;
        sentences.push(text);
        fromLine(text.replace(/\.$/, ""), line);
    };
    if (bad && reply) {
        if (reply.san.endsWith("#")) {
            sentences.push(
                `${SIDE[opponent]} answers ${reply.san}, checkmate.`,
            );
            fromLine(`${reply.san} mates`, "reply");
        } else if (replyIdea?.motif || replyIdea?.mates) {
            const text = describeIdea(replyIdea);
            sentences.push(`${SIDE[opponent]} answers ${text}.`);
            fromLine(text, "reply");
            result(moved.fen, replyPv!, opponent, "reply");
        } else {
            const replyGains = newFacts(after, factsFromFen(reply.fen))
                .filter((f) => f.victim === side)
                .map(threatPhrase)
                .filter((p): p is string => !!p);
            const how = replyGains.length ? ` and ${joinAnd(replyGains)}` : "";
            sentences.push(`${SIDE[opponent]} answers ${reply.san}${how}.`);
            replyGains.forEach((g) => fact(`${reply.san} ${g}`));
            result(moved.fen, replyPv!, opponent, "reply");
        }
    }

    // the better move: only once the move is judged
    const bestMove =
        input.bestUci && input.bestUci !== input.uci
            ? play(input.fenBefore, input.bestUci)
            : undefined;
    if (bad && bestMove) {
        const bestIdea = bestPv ? lineIdea(input.fenBefore, bestPv) : undefined;
        if (bestIdea?.motif || bestIdea?.mates) {
            // the better move's idea, named: "Better was Nxf7, a fork of …"
            const text = describeIdea(bestIdea);
            sentences.push(`Better was ${text}.`);
            fromLine(text, "best");
        } else {
            const bestDone = achievements(
                before,
                factsFromFen(bestMove.fen),
                side,
            );
            const why = bestDone.length ? `: it ${joinAnd(bestDone)}` : "";
            sentences.push(`Better was ${bestMove.san}${why}.`);
            bestDone.forEach((d) => fact(`${bestMove.san} ${d}`));
            if (bestPv) result(input.fenBefore, bestPv, side, "best");
        }
    }

    return {
        fenBefore: input.fenBefore,
        move: { uci: input.uci, san: moved.san },
        side,
        best:
            input.bestUci && play(input.fenBefore, input.bestUci)
                ? {
                      uci: input.bestUci,
                      san: play(input.fenBefore, input.bestUci)!.san,
                  }
                : undefined,
        evaluation: {
            before: toMover(evBefore, side),
            after: toMover(evAfter, side),
            depth,
            class: verdict?.class,
            loss: verdict?.loss,
        },
        reply:
            reply && replyPv ? { uci: replyPv[0], san: reply.san } : undefined,
        lines,
        evidence,
        text: sentences,
        limits,
        inconclusive,
        validation: { ok: problems.length === 0, problems },
    };
}
