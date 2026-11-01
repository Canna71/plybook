// Repertoire training: the user's own lines (a PGN with variations), drilled line by line
// with spaced repetition. Every position where it is the user's move is a card; any of the
// moves the repertoire gives there counts as right.

import { Chess, Color, parseUci } from "chessops";
import { makeFen, parseFen } from "chessops/fen";
import type { GameModel } from "./GameModel";
import type { AnyNode } from "./pgn";

export type Step = {
    fenBefore: string;
    uci: string;
    san: string;
    /** Played by the side the repertoire is for */
    userMove: boolean;
};

/** From the start to one leaf of the move tree */
export type Line = Step[];

// Mirrors RepertoireCard in src-tauri/src/repertoire.rs
export type Card = {
    /** The position, without move counters */
    fen: string;
    /** Leitner box: 1 just learned … BOX_DAYS.length - 1 well known */
    box: number;
    /** ISO time when it should come back */
    due: string;
    reviews: number;
    lapses: number;
};

/** Days until the next review for each box; box 0 means never seen. */
export const BOX_DAYS = [0, 1, 3, 7, 14, 30, 90];

/** Positions are the same whatever the move counters say. */
export const fenKey = (fen: string) => fen.split(" ").slice(0, 4).join(" ");

/** Every line of the repertoire, from the starting position to each leaf. */
export function extractLines(game: GameModel, side: Color): Line[] {
    const lines: Line[] = [];
    const walk = (node: AnyNode, fen: string, turn: Color, line: Line) => {
        if (node.children.length === 0) {
            if (line.length) lines.push(line);
            return;
        }
        for (const child of node.children) {
            const step: Step = {
                fenBefore: fen,
                uci: child.data.uci,
                san: child.data.san,
                userMove: turn === side,
            };
            walk(child, child.data.fen, child.data.turn, [...line, step]);
        }
    };
    walk(game.moves, game.initial.fen, game.initial.turn, []);
    return lines;
}

/** The position after a step of a line. */
export function fenAfter(step: Step): string {
    const pos = Chess.fromSetup(parseFen(step.fenBefore).unwrap()).unwrap();
    pos.play(parseUci(step.uci)!);
    return makeFen(pos.toSetup());
}

/** The user's moves in each position (several if the repertoire has alternatives). */
export function expectedMoves(lines: Line[]): Map<string, Set<string>> {
    const moves = new Map<string, Set<string>>();
    for (const step of lines.flat()) {
        if (!step.userMove) continue;
        const key = fenKey(step.fenBefore);
        if (!moves.has(key)) moves.set(key, new Set());
        moves.get(key)!.add(step.uci);
    }
    return moves;
}

const DAY = 86_400_000;

/** The card after an answer. New cards start in box 1; a mistake sends a card back there. */
export function review(
    card: Card | undefined,
    fen: string,
    correct: boolean,
    now: Date,
): Card {
    const box =
        !card || !correct ? 1 : Math.min(card.box + 1, BOX_DAYS.length - 1);
    // a missed card comes back in this session; a learned one tomorrow at the earliest
    const wait = card && !correct ? 0 : BOX_DAYS[box] * DAY;
    return {
        fen: fenKey(fen),
        box,
        due: new Date(now.getTime() + wait).toISOString(),
        reviews: (card?.reviews ?? 0) + 1,
        lapses: (card?.lapses ?? 0) + (card && !correct ? 1 : 0),
    };
}

export type CardState = "new" | "due" | "later";

export function cardState(card: Card | undefined, now: Date): CardState {
    if (!card) return "new";
    return new Date(card.due).getTime() <= now.getTime() ? "due" : "later";
}

/** How many of the user's positions are due and how many were never seen. */
export function counts(lines: Line[], cards: Map<string, Card>, now: Date) {
    let due = 0;
    let fresh = 0;
    for (const key of expectedMoves(lines).keys()) {
        const state = cardState(cards.get(key), now);
        if (state === "due") due++;
        else if (state === "new") fresh++;
    }
    return { due, new: fresh };
}

/**
 * The next line to drill: among the lines with due cards (reviews first, then new moves, at
 * most `newPerLine` new ones so lines are learned a bit at a time), the one with the most.
 * Ties are broken by `random`, so the order varies.
 */
export function pickLine(
    lines: Line[],
    cards: Map<string, Card>,
    now: Date,
    random: () => number = Math.random,
): Line | undefined {
    let best: Line | undefined;
    let bestScore = 0;
    let ties = 0;
    for (const line of lines) {
        let due = 0;
        let fresh = 0;
        for (const step of line) {
            if (!step.userMove) continue;
            const state = cardState(cards.get(fenKey(step.fenBefore)), now);
            if (state === "due") due++;
            else if (state === "new") fresh++;
        }
        // reviews weigh more than new moves
        const score = due * 100 + fresh;
        if (score === 0) continue;
        if (score > bestScore) {
            best = line;
            bestScore = score;
            ties = 1;
        } else if (score === bestScore && random() < 1 / ++ties) {
            best = line;
        }
    }
    return best;
}

/** When the next card comes due, if nothing is due now. */
export function nextDue(cards: Map<string, Card>): Date | undefined {
    let next: number | undefined;
    for (const card of cards.values()) {
        const t = new Date(card.due).getTime();
        if (next === undefined || t < next) next = t;
    }
    return next === undefined ? undefined : new Date(next);
}
