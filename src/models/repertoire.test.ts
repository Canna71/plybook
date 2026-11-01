import { describe, expect, it } from "vitest";
import { makeGame } from "./pgn";
import {
    BOX_DAYS,
    Card,
    counts,
    expectedMoves,
    extractLines,
    fenAfter,
    fenKey,
    pickLine,
    review,
} from "./repertoire";

// A small White repertoire: 1. e4, against 1...e5 the Italian or (alternative) the Scotch,
// against 1...c5 the Alapin
const PGN =
    "1. e4 e5 (1... c5 2. c3 d5 3. exd5) 2. Nf3 Nc6 3. Bc4 (3. d4 exd4 4. Nxd4) Bc5 4. c3 *";
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const NOW = new Date("2026-10-24T12:00:00Z");

const white = () => extractLines(makeGame(PGN), "white");

describe("extractLines", () => {
    it("follows every branch to its end", () => {
        expect(white().map((l) => l.map((s) => s.san).join(" "))).toEqual([
            "e4 e5 Nf3 Nc6 Bc4 Bc5 c3",
            "e4 e5 Nf3 Nc6 d4 exd4 Nxd4",
            "e4 c5 c3 d5 exd5",
        ]);
    });

    it("marks the moves of the side the repertoire is for", () => {
        const [first] = white();
        expect(first.map((s) => s.userMove)).toEqual([
            true,
            false,
            true,
            false,
            true,
            false,
            true,
        ]);
        expect(first[0].fenBefore).toBe(START);
        const black = extractLines(makeGame(PGN), "black")[0];
        expect(black[1]).toMatchObject({ san: "e5", userMove: true });
    });

    it("gives the position after each step", () => {
        const [first] = white();
        expect(fenAfter(first[0])).toBe(first[1].fenBefore);
        expect(fenAfter(first[first.length - 1])).toBe(
            "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R b KQkq - 0 4",
        );
    });
});

describe("expectedMoves", () => {
    it("accepts every repertoire move in a position", () => {
        const moves = expectedMoves(white());
        // after 1. e4 e5 2. Nf3 Nc6 both Bc4 and d4 are in the repertoire
        const afterNc6 = [...moves.entries()].find(([, m]) => m.has("f1c4"))!;
        expect([...afterNc6[1]].sort()).toEqual(["d2d4", "f1c4"]);
        // e4 once, though three lines start with it
        expect(moves.get(fenKey(START))).toEqual(new Set(["e2e4"]));
        expect(moves.size).toBe(7);
    });
});

describe("review", () => {
    it("moves a card through the boxes and back on a mistake", () => {
        let card: Card = review(undefined, START, true, NOW);
        expect(card).toMatchObject({ box: 1, reviews: 1, lapses: 0 });
        expect(new Date(card.due).getTime() - NOW.getTime()).toBe(
            BOX_DAYS[1] * 86_400_000,
        );
        card = review(card, START, true, NOW);
        expect(card.box).toBe(2);
        card = review(card, START, false, NOW);
        expect(card).toMatchObject({ box: 1, lapses: 1, reviews: 3 });
        // a missed card is due again right away
        expect(card.due).toBe(NOW.toISOString());
        expect(card.fen).toBe(fenKey(START));
    });

    it("stops at the last box", () => {
        let card = review(undefined, START, true, NOW);
        for (let i = 0; i < 20; i++) card = review(card, START, true, NOW);
        expect(card.box).toBe(BOX_DAYS.length - 1);
    });
});

describe("scheduling", () => {
    it("counts new and due positions", () => {
        const lines = white();
        expect(counts(lines, new Map(), NOW)).toEqual({ due: 0, new: 7 });
        const learned = new Map<string, Card>();
        for (const key of expectedMoves(lines).keys()) {
            learned.set(key, review(undefined, key, true, NOW));
        }
        expect(counts(lines, learned, NOW)).toEqual({ due: 0, new: 0 });
        const tomorrow = new Date(NOW.getTime() + 86_400_000);
        expect(counts(lines, learned, tomorrow)).toEqual({ due: 7, new: 0 });
    });

    it("drills due lines before new ones and stops when nothing is due", () => {
        const lines = white();
        const cards = new Map<string, Card>();
        // learn everything, then forget the Alapin's last move
        for (const key of expectedMoves(lines).keys()) {
            cards.set(key, review(undefined, key, true, NOW));
        }
        expect(pickLine(lines, cards, NOW)).toBeUndefined();
        const alapin = lines[2];
        const last = alapin[alapin.length - 1];
        cards.set(fenKey(last.fenBefore), {
            ...cards.get(fenKey(last.fenBefore))!,
            due: NOW.toISOString(),
        });
        expect(pickLine(lines, cards, NOW)).toBe(alapin);
        // with nothing learned, the lines with most moves to learn come first (the two 1...e5
        // lines have 4 White moves, the Alapin 3); their tie is broken at random
        expect(pickLine(lines, new Map(), NOW, () => 0)).toBe(lines[1]);
        expect(pickLine(lines, new Map(), NOW, () => 0.99)).toBe(lines[0]);
    });
});
