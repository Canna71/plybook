import { describe, expect, it } from "vitest";
import { parsePasted } from "./pasted";

describe("parsePasted", () => {
    it("recognises a FEN, also a bare board", () => {
        const fen =
            "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3";
        expect(parsePasted(`  ${fen}\n`)).toEqual({ kind: "fen", fen });
        expect(parsePasted("8/8/8/8/8/8/8/K6k")).toEqual({
            kind: "fen",
            fen: "8/8/8/8/8/8/8/K6k w - - 0 1",
        });
    });

    it("rejects impossible positions and ordinary text", () => {
        expect(parsePasted("8/8/8/8/8/8/8/8 w - - 0 1")).toBeUndefined();
        expect(parsePasted("rnbqkbnr/pppppppp")).toBeUndefined();
        expect(parsePasted("hello world")).toBeUndefined();
        expect(parsePasted("")).toBeUndefined();
    });

    it("recognises PGN with or without tags", () => {
        const tagged = '[White "A"]\n[Black "B"]\n\n1. e4 e5 2. Nf3 *';
        expect(parsePasted(tagged)).toEqual({
            kind: "pgn",
            pgn: tagged,
            games: 1,
        });
        expect(parsePasted("1. d4 d5 2. c4")).toMatchObject({
            kind: "pgn",
            games: 1,
        });
        const two = `${tagged}\n\n[White "C"]\n\n1. c4 *`;
        expect(parsePasted(two)).toMatchObject({ games: 2 });
        // tags without moves are not a game
        expect(parsePasted('[Event "x"]\n\n*')).toBeUndefined();
    });

    it("recognises Lichess game links", () => {
        for (const url of [
            "https://lichess.org/k8OVq8Y5",
            "https://lichess.org/k8OVq8Y5abcd",
            "https://lichess.org/k8OVq8Y5/black#48",
            "http://www.lichess.org/k8OVq8Y5?foo=1",
        ]) {
            expect(parsePasted(url)).toEqual({
                kind: "lichess",
                gameId: "k8OVq8Y5",
            });
        }
        expect(parsePasted("https://lichess.org/study/abc")).toBeUndefined();
        expect(parsePasted("https://evil.example/k8OVq8Y5")).toBeUndefined();
    });
});
