import { describe, expect, it } from "vitest";
import { parseSquare } from "chessops";
import { frameAt, lineFrames, squareOrigin } from "./boardframes";
import { makeGame, Path } from "./pgn";

const sq = (name: string) => parseSquare(name)!;

describe("squareOrigin", () => {
    it("puts a1 bottom left for White and top right for Black", () => {
        expect(squareOrigin(sq("a1"), "white", 800)).toEqual({ x: 0, y: 700 });
        expect(squareOrigin(sq("a1"), "black", 800)).toEqual({ x: 700, y: 0 });
        expect(squareOrigin(sq("h8"), "white", 800)).toEqual({ x: 700, y: 0 });
        expect(squareOrigin(sq("e4"), "white", 400)).toEqual({
            x: 200,
            y: 200,
        });
    });
});

describe("frames", () => {
    // 1.e4 e5 2.Nf3 (2.Bc4) Nc6
    const game = makeGame("1. e4 e5 2. Nf3 (2. Bc4) Nc6 *");

    it("draws a position with the move that led to it", () => {
        const e4 = game.pathAtMainlinePly(1);
        expect(frameAt(game, e4).lastMove).toEqual({
            from: sq("e2"),
            to: sq("e4"),
        });
        expect(frameAt(game, Path.root).lastMove).toBeUndefined();
    });

    it("animates the line shown, from the start to its end", () => {
        expect(lineFrames(game, game.pathAtMainlinePly(1))).toHaveLength(5);
        // in the side line 2.Bc4: start, e4, e5, Bc4
        const bc4 = game.nodeAt(game.pathAtMainlinePly(2))!.children[1];
        const frames = lineFrames(game, (bc4.data as { path: Path }).path);
        expect(frames).toHaveLength(4);
        expect(frames.at(-1)!.lastMove).toEqual({
            from: sq("f1"),
            to: sq("c4"),
        });
    });
});
