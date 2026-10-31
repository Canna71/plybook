import { describe, expect, it } from "vitest";
import { gameHistory, historyFor, withMove } from "./gamehistory";
import { makeGame } from "./pgn";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// after 1.Nf3 Nf6 2.Ng1 Ng8: the start position again
const BACK = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 4 3";

describe("history", () => {
    const game = makeGame("1. Nf3 Nf6 2. Ng1 Ng8 *");
    const last = game.mainline.at(-1)!.path;

    it("gives the game's start and moves to a position", () => {
        expect(gameHistory(game, last)).toEqual({
            start: START,
            moves: ["g1f3", "g8f6", "f3g1", "f6g8"],
        });
    });

    it("keeps a history that leads to the position, even a repeated one", () => {
        const h = gameHistory(game, last);
        expect(historyFor(h, BACK)).toEqual(h);
    });

    it("drops a history that is not this position's", () => {
        const h = gameHistory(game, last);
        expect(
            historyFor(
                h,
                "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
            ),
        ).toBeUndefined();
        // an illegal move in it
        expect(
            historyFor({ start: START, moves: ["e2e5"] }, START),
        ).toBeUndefined();
        expect(historyFor(undefined, START)).toBeUndefined();
    });

    it("writes castling as engines read it, not as the king taking its rook", () => {
        const castled = makeGame(
            "1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. O-O d6 5. d3 Bg4 6. Nc3 Qd7 7. Be3 O-O-O *",
        );
        const end = castled.mainline.at(-1)!;
        const h = gameHistory(castled, end.path)!;
        expect(h.moves).toContain("e1h1");
        const sent = historyFor(h, end.fen)!;
        expect(sent.moves[6]).toBe("e1g1");
        expect(sent.moves[13]).toBe("e8c8");
        expect(sent.moves).not.toContain("e1h1");
        expect(sent.moves).not.toContain("e8a8");
    });

    it("goes one move further", () => {
        expect(withMove({ start: START, moves: ["e2e4"] }, "e7e5")).toEqual({
            start: START,
            moves: ["e2e4", "e7e5"],
        });
    });
});
