// The tutor (P2.9, T1): an opponent that plays "as bad as needed" for your level and a coach
// that speaks when the position needs it. These are its decisions, from engine lines turned
// into win chances; the searches and the words around them live elsewhere. No DOM, no
// engine: pure functions, for tests.

import { Chess, makeSquare, parseUci } from "chessops";
import { parseFen } from "chessops/fen";

/** A candidate move with the win chance (0–100) it keeps for the side playing it. */
export type Candidate = { uci: string; win: number };

/** How talkative the tutor is: "quiet" only for blunders, "chatty" for small slips too. */
export type Chattiness = "quiet" | "normal" | "chatty";

/** Strength settings derived from your rating. */
export type TutorLevel = {
    elo: number;
    /** The most win chance the engine gives away on a normal move */
    maxLoss: number;
    /** The engine's win chance it tries not to go beyond: a fair fight, not a crushing */
    target: number;
    /** How often the engine plays a deliberate, human-like mistake */
    mistakeRate: number;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** The tutor's strength for a player of `elo` (from 600 to 2400; outside, the ends). */
export function tutorLevel(elo: number): TutorLevel {
    const t = clamp01((elo - 600) / 1800);
    return {
        elo,
        maxLoss: Math.round(lerp(28, 3, t)),
        target: Math.round(lerp(58, 75, t)),
        mistakeRate: +lerp(0.15, 0.02, t).toFixed(3),
    };
}

export type TutorChoice = {
    uci: string;
    /** Win chance given up compared with the engine's best move */
    loss: number;
    /** A deliberate mistake: worth pointing out to you ("can you punish it?") */
    mistake: boolean;
};

/** A deliberate mistake loses this much, no more: believable, punishable, not a free queen. */
const MISTAKE_RANGE = [10, 30];

/**
 * The engine's move for the tutor, from its candidates (best first, wins for the engine).
 * When the engine is winning beyond its target, it picks the candidate nearest the target
 * within its allowance; sometimes it plays a mistake from MISTAKE_RANGE; otherwise its best.
 */
export function pickTutorMove(
    candidates: Candidate[],
    level: TutorLevel,
    random: () => number = Math.random,
): TutorChoice | undefined {
    if (!candidates.length) return undefined;
    const best = candidates[0];
    const lossOf = (c: Candidate) => Math.max(0, best.win - c.win);
    // easing off stays within the allowance and never walks into a lost position (below 35%)
    const allowed = candidates.filter(
        (c) => lossOf(c) <= level.maxLoss && c.win >= 35,
    );
    const mistakes = candidates.filter(
        (c) =>
            lossOf(c) >= MISTAKE_RANGE[0] &&
            lossOf(c) <= MISTAKE_RANGE[1] &&
            c.win >= 25,
    );
    if (mistakes.length && random() < level.mistakeRate) {
        const pick = mistakes[Math.floor(random() * mistakes.length)];
        return { uci: pick.uci, loss: lossOf(pick), mistake: true };
    }
    if (best.win > level.target && allowed.length > 1) {
        // as bad as needed: the move that keeps the game nearest the target
        const pick = [...allowed].sort(
            (a, b) =>
                Math.abs(a.win - level.target) - Math.abs(b.win - level.target),
        )[0];
        return { uci: pick.uci, loss: lossOf(pick), mistake: false };
    }
    return { uci: best.uci, loss: 0, mistake: false };
}

/** The win chance your move gave away, from which "Are you sure?" is asked. */
const ASK_FROM: Record<Chattiness, number> = {
    quiet: 25,
    normal: 15,
    chatty: 8,
};

/**
 * Whether to stop and ask about your move: it gave away at least the chattiness threshold
 * (your win chance before and after, 0–100), and it was not the best move.
 */
export const shouldAsk = (
    winBefore: number,
    winAfter: number,
    chattiness: Chattiness,
    wasBest = false,
) => !wasBest && winBefore - winAfter >= ASK_FROM[chattiness];

/**
 * A move that stands out for you (your candidates, best first): much better than the next
 * one and good enough to matter. Then the tutor says "There's something strong here".
 */
export function standsOut(candidates: Candidate[]): Candidate | undefined {
    const [first, second] = candidates;
    if (!first || first.win < 65) return undefined;
    if (second && first.win - second.win < 20) return undefined;
    return first;
}

// #region after the game (T4)

/** One of your moves, as the tutor saw it. */
export type MoveRecord = {
    /** "12." or "12..." and the move: "12. Nf3" */
    label: string;
    /** Win chance it gave away (0 for the best move) */
    loss: number;
    /** The motif of the opponent's answer, when your move allowed one ("fork") */
    allowed?: string;
    /** A move stood out in that position: did you find it? */
    chance?: { found: boolean; motif?: string };
};

export type GameResult = "win" | "draw" | "loss";

export type GameSummary = {
    result?: GameResult;
    /** Your moves that cost the most, worst first (at most three) */
    mistakes: MoveRecord[];
    /** Strong moves you found */
    found: MoveRecord[];
    /** Strong moves you missed */
    missed: MoveRecord[];
    /** Puzzle themes to train (Lichess theme names), the most frequent first */
    train: string[];
};

/** What counts as a mistake in the summary: the "normal" chattiness threshold. */
const SUMMARY_MISTAKE = 15;

/** The game in a few lines: your worst moves, your best finds, what to train. */
export function summarizeGame(
    records: MoveRecord[],
    result?: GameResult,
): GameSummary {
    const mistakes = records
        .filter((r) => r.loss >= SUMMARY_MISTAKE)
        .sort((a, b) => b.loss - a.loss)
        .slice(0, 3);
    const found = records.filter((r) => r.chance?.found);
    const missed = records.filter((r) => r.chance && !r.chance.found);
    // themes: what your mistakes allowed, and the chances you missed
    const counts = new Map<string, number>();
    for (const motif of [
        ...mistakes.map((r) => r.allowed),
        ...missed.map((r) => r.chance?.motif),
    ]) {
        if (motif) counts.set(motif, (counts.get(motif) ?? 0) + 1);
    }
    const train = [...counts]
        .sort((a, b) => b[1] - a[1])
        .map(([motif]) => motif);
    return { result, mistakes, found, missed, train };
}

/** Level limits for the automatic level */
const ELO_RANGE = [600, 2200];
/** How far one game moves the automatic level */
const ELO_STEP = 100;

/**
 * The next game's level, when it is set automatically: up after a win (or a draw with no
 * mistakes), down after a loss with several mistakes, else the same.
 */
export function nextLevel(elo: number, summary: GameSummary): number {
    const many = summary.mistakes.length >= 2;
    let next = elo;
    if (
        summary.result === "win" ||
        (summary.result === "draw" && !summary.mistakes.length)
    ) {
        next = elo + ELO_STEP;
    } else if (summary.result === "loss" && many) {
        next = elo - ELO_STEP;
    }
    return Math.max(ELO_RANGE[0], Math.min(ELO_RANGE[1], next));
}

/** Puzzle attempts before the puzzle rating says something about you */
export const MIN_PUZZLE_ATTEMPTS = 20;
/**
 * Puzzle ratings run above playing strength (a puzzle shows there is something to find); a
 * rough gap, which the automatic level then corrects game by game.
 */
const PUZZLE_GAP = 300;

/**
 * The automatic level to start from, given the puzzle rating and how many puzzles it rests
 * on; undefined when there are too few to go by.
 */
export function startLevel(
    puzzleRating: number,
    attempts: number,
): number | undefined {
    if (attempts < MIN_PUZZLE_ATTEMPTS) return undefined;
    const elo = Math.round((puzzleRating - PUZZLE_GAP) / ELO_STEP) * ELO_STEP;
    return Math.max(ELO_RANGE[0], Math.min(ELO_RANGE[1], elo));
}
// #endregion

const NAMES = {
    pawn: "a pawn",
    knight: "the knight",
    bishop: "the bishop",
    rook: "the rook",
    queen: "the queen",
    king: "the king",
};

/**
 * Hints for a move, in steps: first which piece ("Look at the knight on g5"), then where it
 * goes ("The knight on g5 goes to f7"). Never the move's notation outright.
 */
export function hintSteps(fen: string, uci: string): string[] {
    const setup = parseFen(fen);
    const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    const move = parseUci(uci);
    if (!pos?.isOk || !move || !("from" in move)) return [];
    const piece = pos.value.board.get(move.from);
    if (!piece) return [];
    const name =
        piece.role === "pawn"
            ? `the pawn on ${makeSquare(move.from)}`
            : `${NAMES[piece.role]} on ${makeSquare(move.from)}`;
    return [
        `Look at ${name}.`,
        `${name[0].toUpperCase()}${name.slice(1)} goes to ${makeSquare(move.to)}.`,
    ];
}
