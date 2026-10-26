// What a move stops and what it threatens (P2.8 R2, docs/REASONS.md). A threat is what the
// other side would play if it were its turn again: the engine's line in the null-move position
// (models/threat.ts). Named with the motif detectors (motifs.ts) and measured with the
// material the line wins (whatif.ts). Pure functions over engine lines, for tests; the
// searches themselves are threatSearch (engine/threatsearch.ts).

import { Chess, Color, opposite, parseSquare, parseUci } from "chessops";
import { makeFen, parseFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import { lineOutcome } from "../models/whatif";
import { nullMoveFen } from "../models/threat";
import { lineMotifs, mainReasons, Motif, Reason } from "./motifs";

/** Motifs good enough to name in an explanation (docs/REASONS.md, R1 results). */
export const TRUSTED: ReadonlySet<Motif> = new Set<Motif>([
    "mate",
    "smotheredMate",
    "backRankMate",
    "doubleCheck",
    "fork",
    "skewer",
    "discoveredAttack",
    "hangingPiece",
    "promotion",
]);

/** How far into a line its idea is looked for (like a puzzle: a few moves, cashed in). */
const IDEA_PLIES = 8;
/** The motif must start within this ply: our first three moves */
const IDEA_START = 4;

/** What a line does for the side that plays it. */
export type LineIdea = {
    /** The side playing the line */
    side: Color;
    /** Its first move, in SAN */
    san: string;
    /** The most important trusted motif in it, with the pieces it is about */
    motif?: Reason & { pieces: string[] };
    /** Material won once the captures are over, in pawns */
    gain: number;
    /** The line ends in mate */
    mates: boolean;
};

const positionOf = (fen: string) => {
    const setup = parseFen(fen);
    const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    return pos?.isOk ? pos.value : undefined;
};

/** The position after `uci`, or undefined if it is not legal there. */
export function playUci(fen: string, uci: string): string | undefined {
    const pos = positionOf(fen);
    const move = parseUci(uci);
    if (!pos || !move || !pos.isLegal(move)) return undefined;
    pos.play(move);
    return makeFen(pos.toSetup());
}

/**
 * "queen on d8": the pieces on a reason's squares where it happens: after the move, or before
 * it for a capture (a hanging piece is named, not the piece that took it). Kings go first,
 * without a square: "king".
 */
function piecesOf(fen: string, pv: string[], reason: Reason): string[] {
    const pos = positionOf(fen)!;
    const upTo = reason.motif === "hangingPiece" ? reason.ply : reason.ply + 1;
    for (const uci of pv.slice(0, upTo)) pos.play(parseUci(uci)!);
    const names = reason.squares.map((sq) => {
        const piece = pos.board.get(parseSquare(sq)!);
        if (!piece) return sq;
        return piece.role === "king" ? "king" : `${piece.role} on ${sq}`;
    });
    const [actor, ...targets] = names;
    return [
        actor,
        ...targets.filter((t) => t === "king"),
        ...targets.filter((t) => t !== "king"),
    ];
}

/**
 * What `pv` achieves from `fen` for the side to move there. `lastCapture`: the square where
 * the move that led to `fen` captured, if it did (taking back is not winning a free piece).
 */
export function lineIdea(
    fen: string,
    pv: string[],
    lastCapture?: string,
): LineIdea | undefined {
    const pos = positionOf(fen);
    const first = pv[0] && parseUci(pv[0]);
    if (!pos || !first || !pos.isLegal(first)) return undefined;
    const side = pos.turn;
    const outcome = lineOutcome(fen, pv, side);
    // the idea of a move is in its next few moves, not deep in a long engine line
    const near = pv.slice(0, IDEA_PLIES);
    const reason = mainReasons(lineMotifs(fen, near, lastCapture)).find(
        (r) => TRUSTED.has(r.motif) && r.ply <= IDEA_START,
    );
    return {
        side,
        san: makeSan(pos, first),
        motif: reason && { ...reason, pieces: piecesOf(fen, pv, reason) },
        gain: outcome?.materialChange ?? 0,
        mates: outcome?.mated === opposite(side),
    };
}

/** Worth calling a threat: a mate, or at least a minor piece's worth, or a pawn by a motif. */
export const isThreat = (idea: LineIdea | undefined): idea is LineIdea =>
    !!idea &&
    (idea.mates || idea.gain >= 3 || (idea.gain >= 1 && !!idea.motif));

/**
 * The threat `uci` stops: the opponent's line in the null-move position before the move
 * (`threatPv`) that no longer works after it. `replyPv`, the engine's answer after the move,
 * is the judge when given: if it still gets as much, nothing was stopped.
 */
export function stoppedThreat(
    fenBefore: string,
    uci: string,
    threatPv: string[],
    replyPv?: string[],
): LineIdea | undefined {
    const passed = nullMoveFen(fenBefore);
    const threat = passed ? lineIdea(passed, threatPv) : undefined;
    if (!isThreat(threat)) return undefined;
    const after = playUci(fenBefore, uci);
    if (!after) return undefined;
    const still = (idea: LineIdea | undefined) =>
        isThreat(idea) &&
        (threat.mates ? idea.mates : idea.gain >= threat.gain - 1);
    // the same moves after ours, and the engine's own answer
    if (still(lineIdea(after, threatPv))) return undefined;
    if (replyPv && still(lineIdea(after, replyPv))) return undefined;
    return threat;
}

/** What `uci` threatens: our line in the null-move position after it (`ourPv`). */
export function createdThreat(
    fenBefore: string,
    uci: string,
    ourPv: string[],
): LineIdea | undefined {
    const after = playUci(fenBefore, uci);
    const passed = after && nullMoveFen(after);
    const idea = passed ? lineIdea(passed, ourPv) : undefined;
    return isThreat(idea) ? idea : undefined;
}

// #region words

const the = (piece: string) => `the ${piece}`;
const join = (parts: string[]) =>
    parts.length <= 1
        ? (parts[0] ?? "")
        : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;

/** "a fork of the queen on d8 and the rook on h8", "mate", "winning a knight"… */
function motifWords(motif: Reason & { pieces: string[] }): string {
    const [actor, ...targets] = motif.pieces;
    switch (motif.motif) {
        case "mate":
            return "mate";
        case "smotheredMate":
            return "a smothered mate";
        case "backRankMate":
            return "mate on the back rank";
        case "doubleCheck":
            return "a double check";
        case "fork":
            return `a fork of ${join(targets.map(the))}`;
        case "skewer":
            return `a skewer: ${the(targets[0])} must move and ${the(targets[1])} falls`;
        case "discoveredAttack":
            return targets[0] === "king"
                ? `a discovered check by ${the(actor)}`
                : `a discovered attack by ${the(actor)} on ${the(targets[0] ?? "")}`;
        case "hangingPiece":
            return `winning ${the(actor)}, which nothing defends`;
        case "promotion":
            return "a promotion";
        case "pin":
            return `a pin of ${the(targets[0] ?? "")}`;
    }
}

/** The piece worth `gain` pawns, roughly, for "winning a knight". */
const gainWords = (gain: number) =>
    gain >= 9
        ? "winning the queen"
        : gain >= 5
          ? "winning a rook"
          : gain >= 3
            ? "winning a piece"
            : gain >= 2
              ? "winning two pawns"
              : "winning a pawn";

/** "Nxf7, a fork of the queen on d8 and the rook on h8" */
export function describeIdea(idea: LineIdea): string {
    if (idea.motif && idea.motif.motif !== "mate") {
        // the first move is the motif, or the way to it
        const how = idea.motif.ply === 0 ? "" : "then ";
        return `${idea.san}, ${how}${motifWords(idea.motif)}`;
    }
    if (idea.mates)
        return idea.san.endsWith("#")
            ? idea.san
            : `${idea.san}, with mate to follow`;
    return `${idea.san}, ${gainWords(idea.gain)}`;
}
// #endregion
