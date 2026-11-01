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
import {
    describeIdea,
    describePrevented,
    isProphylaxis,
    LineIdea,
    lineIdea,
    Prevented,
} from "../reasons/threats";
import { MoveValues, positionalReasons } from "../reasons/positional";
import { keepsWords, keptWords, onlyMove } from "../reasons/onlymove";
import { describeSacrifice, saidSacrifice } from "../reasons/sacrifice";
import { compareFutures, Futures } from "../reasons/futures";
import type { EngineInfo } from "../engine/engineinterfaces";

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
    threats?: { stopped?: LineIdea; created?: LineIdea; prevented?: Prevented };
    /** Stockfish's piece values before and after the move, when the engine is Stockfish */
    values?: MoveValues;
    /** The engine's evaluations of the positions before and after the move, from White's side */
    evaluations?: { before?: Evaluation; after?: Evaluation };
    /**
     * The game's positions before `fenBefore`, oldest first, when the move is in a game: a
     * FEN alone does not show repetitions
     */
    history?: string[];
    /** The engine searched with the game's moves, not only the FEN: it counts repetitions */
    engineSawGame?: boolean;
    /**
     * The engine's two best lines in fenBefore (MultiPV 2), scored from White's side: is the
     * best move the only good one? (reasons/onlymove.ts)
     */
    alternatives?: EngineInfo[];
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
    book: "is a book move",
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

/** The position with `side` to move (no en passant): what that side could play there. */
function withTurn(fen: string, side: Color): string {
    const parts = fen.split(" ");
    parts[1] = side === "white" ? "w" : "b";
    parts[3] = "-";
    return parts.join(" ");
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
    lasting?: Set<string>,
): string[] {
    const created = newFacts(before, after).filter(
        (f) =>
            f.victim === opposite(side) &&
            !(f.kind === "hanging" && told.includes(squareOf(f))) &&
            // gains the answer undoes are no point (F.37a); `lasting`: the keys after it
            (!lasting || lasting.has(f.key)),
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

/** A material balance this far beyond the engine's score is not kept. */
const MATERIAL_SLACK = 1.5;

/**
 * "After Qxe3 Bxe3 dxe5: Black wins material (+1)." when a line wins material or mates, up to
 * a capture (F.37a). With `score`, the engine's evaluation of the line for `side` in pawns, up
 * to the last capture whose balance it bears out (a score above the balance is fine: more is
 * coming). A line may end on a capture that is taken back after it (Bxg4 Be2 Bxe2: +12 where
 * the score is +8.6, so "After Bxg4: +9"), or take a piece the engine sees lost again (4.Nc3:
 * "+3" where it said +1.2). Without a score, up to the line's last capture.
 */
function consequence(fen: string, pv: string[], side: Color, score?: number) {
    const outcome = lineOutcome(fen, pv, side);
    if (!outcome?.sans.length) return undefined;
    if (outcome.mated)
        return `After ${outcome.sans.join(" ")}: ${describeOutcome(outcome)}.`;
    let at = outcome.changeAt;
    if (score !== undefined) {
        at = 0;
        outcome.steps.forEach((material, i) => {
            const changed = material !== (outcome.steps[i - 1] ?? 0);
            const balance = outcome.start + material;
            const borne =
                material > 0
                    ? balance <= score + MATERIAL_SLACK
                    : balance >= score - MATERIAL_SLACK;
            if (changed && borne) at = i + 1;
        });
    }
    const material = at ? outcome.steps[at - 1] : 0;
    if (!material) return undefined;
    return `After ${outcome.sans.slice(0, at).join(" ")}: ${describeOutcome({ ...outcome, materialChange: material })}.`;
}

/** An evaluation (White's view) in pawns for `side`; none for a mate score. */
const pawnsFor = (evaluation: Evaluation | undefined, side: Color) =>
    evaluation && "pawns" in evaluation
        ? side === "white"
            ? evaluation.pawns
            : -evaluation.pawns
        : undefined;

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

    // the only good move: the engine's best beats every other by a wide margin (its two lines)
    const only =
        verdict && input.alternatives
            ? onlyMove(
                  input.fenBefore,
                  input.alternatives,
                  input.history?.at(-1),
              )
            : undefined;
    if (only && only.depth !== undefined && only.depth >= MIN_DEPTH) {
        const atLeast = `every other move gives away at least ${only.gap.toFixed(0)}% of ${SIDE[side]}'s winning chances`;
        if (only.best.uci === input.uci) {
            const text = `is the only move that ${keepsWords[only.keeps]}: ${atLeast} (the next best is ${only.second.san})`;
            sentences.push(`It ${text}.`);
            fromLine(text);
        } else if (bad) {
            const text = `Only ${only.best.san} ${keptWords[only.keeps]}: ${atLeast}`;
            sentences.push(`${text}.`);
            fromLine(text);
        }
    }

    // a sacrifice: the move offers material the answer takes, and the line gets it back
    const offered =
        verdict && !bad && replyPv
            ? saidSacrifice(input.fenBefore, [input.uci, ...replyPv])
            : undefined;
    if (offered) {
        const text = describeSacrifice(offered);
        sentences.push(`It ${text}.`);
        fromLine(text, "reply");
    }

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
        } else if (seen === 1 && !input.engineSawGame) {
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
        // prophylaxis: the opponent's wanted move (the engine's) taken away by a pawn (board)
        const prevented = input.threats?.prevented;
        const texts = [
            ...(isProphylaxis(prevented)
                ? [`prevents ${describePrevented(prevented)}`]
                : []),
            ...good.map((r) => r.text),
        ].slice(0, 2);
        if (texts.length) {
            const also = sentences.length > 1 ? "It also " : "It ";
            sentences.push(`${also}${joinAnd(texts)}.`);
            interpret(texts);
        }
    }

    // the opponent's answer and where it leads
    const reply = replyPv?.[0] ? play(moved.fen, replyPv[0]) : undefined;
    // the two futures, the answer's and the better move's, compared (F.37c)
    const futures: Futures =
        bad && input.bestUci !== input.uci
            ? compareFutures(input.fenBefore, input.uci, replyPv, bestPv)
            : {};
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
    // each line's score: the answer's is the position after the move, the better one's before
    const lineScore = (line: LineLabel, who: Color) =>
        pawnsFor(line === "reply" ? evAfter : evBefore, who);
    const result = (fen: string, pv: string[], who: Color, line: LineLabel) => {
        const text = consequence(fen, pv, who, lineScore(line, who));
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
            // what the answer attacks or pins, as long as it lasts: a fact the mover's next move
            // in the line undoes (taking back, a queen trade) is no point (F.37a)
            const next = replyPv?.[1] ? play(reply.fen, replyPv[1]) : undefined;
            const lasting = next
                ? new Set(factsFromFen(next.fen).map((f) => f.key))
                : undefined;
            const replyGains = newFacts(after, factsFromFen(reply.fen))
                .filter((f) => f.victim === side)
                .filter((f) => !lasting || lasting.has(f.key))
                .map(threatPhrase)
                .filter((p): p is string => !!p);
            const how = replyGains.length ? ` and ${joinAnd(replyGains)}` : "";
            sentences.push(`${SIDE[opponent]} answers ${reply.san}${how}.`);
            replyGains.forEach((g) => fact(`${reply.san} ${g}`));
            result(moved.fen, replyPv!, opponent, "reply");
            // what the answer's future costs against the better one's (F.37c): a reading
            if (futures.cost) {
                sentences.push(`It ${futures.cost}.`);
                interpret([futures.cost]);
            }
        }
    }

    // the better move: only once the move is judged
    const bestMove =
        input.bestUci && input.bestUci !== input.uci
            ? play(input.fenBefore, input.bestUci)
            : undefined;
    if (bad && bestMove) {
        const bestIdea = bestPv ? lineIdea(input.fenBefore, bestPv) : undefined;
        const bestSacrifice = bestPv
            ? saidSacrifice(input.fenBefore, bestPv)
            : undefined;
        if (bestSacrifice) {
            // the point of the better line is what it gives: "Better was Bxh7+: it sacrifices …"
            const text = `${bestMove.san}: it ${describeSacrifice(bestSacrifice)}`;
            sentences.push(`Better was ${text}.`);
            fromLine(text, "best");
        } else if (bestIdea?.motif || bestIdea?.mates) {
            // the better move's idea, named: "Better was Nxf7, a fork of …"
            const text = describeIdea(bestIdea);
            sentences.push(`Better was ${text}.`);
            fromLine(text, "best");
        } else {
            // a reason for the better move whenever there is one (F.37b): what it does that
            // outlasts the answer, the answer to the played move it rules out, or else a reading
            // of the position
            const answer = bestPv?.[1]
                ? play(bestMove.fen, bestPv[1])
                : undefined;
            const bestDone = achievements(
                before,
                factsFromFen(bestMove.fen),
                side,
                [],
                answer
                    ? new Set(factsFromFen(answer.fen).map((f) => f.key))
                    : undefined,
            );
            bestDone.forEach((d) => fact(`${bestMove.san} ${d}`));
            // the answer that hurt (a capture, a check, a tactic), if it was there before the
            // move (not one the move made possible: exd5 after d5) and the better move takes
            // it away: it can no longer be played, or no longer takes anything
            const answerUci = replyPv?.[0];
            const hurt =
                reply &&
                answerUci &&
                (isCaptureAt(moved.fen, answerUci) ||
                    reply.san.includes("+") ||
                    replyIdea?.motif);
            const bites = (fen: string) =>
                !!play(fen, answerUci!) &&
                (!isCaptureAt(moved.fen, answerUci!) ||
                    isCaptureAt(fen, answerUci!));
            const stops =
                hurt &&
                bites(withTurn(input.fenBefore, opponent)) &&
                !bites(bestMove.fen)
                    ? `stops ${reply!.san}`
                    : undefined;
            if (stops) fact(`${bestMove.san} ${stops}`);
            const done = [...bestDone, ...(stops ? [stops] : [])];
            const readings = done.length
                ? []
                : futures.gain
                  ? [futures.gain]
                  : positionalReasons(input.fenBefore, input.bestUci!)
                        .filter((r) => r.good)
                        .slice(0, 2)
                        .map((r) => r.text);
            interpret(readings);
            const why = [...done, ...readings];
            sentences.push(
                `Better was ${bestMove.san}${why.length ? `: it ${joinAnd(why)}` : ""}.`,
            );
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
