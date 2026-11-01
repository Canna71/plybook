import { describe, expect, it } from "vitest";
import { reviewGame } from "./backgroundreview";

// 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6?? 4.Qxf7#
const SCHOLAR = `[Event "Test"]
[White "Me"]
[Black "Them"]
[Result "1-0"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0
`;

/** Scores from White's point of view, by the position's move number and side to move. */
const SCRIPT: Record<string, { cp?: number; mate?: number; best: string }> = {
    "1 w": { cp: 30, best: "e2e4" },
    "1 b": { cp: 30, best: "e7e5" },
    "2 w": { cp: 30, best: "g1f3" },
    "2 b": { cp: 0, best: "b8c6" },
    "3 w": { cp: 0, best: "f1c4" },
    "3 b": { cp: 10, best: "g7g6" },
    // after Nf6??: White mates in one
    "4 w": { mate: 1, best: "h5f7" },
};

const search = async (fen: string) => {
    const [, turn, , , , full] = fen.split(" ");
    const line = SCRIPT[`${full} ${turn}`];
    if (!line) return undefined;
    return {
        depth: 12,
        best: line.best,
        score:
            line.mate !== undefined
                ? { type: "mate" as const, value: line.mate }
                : { type: "cp" as const, value: line.cp! },
    };
};

describe("reviewGame", () => {
    it("evaluates every position and marks the blunder", async () => {
        const { game, mistakes } = await reviewGame(SCHOLAR, search);
        expect(mistakes).toEqual({ white: 0, black: 1 });
        const pgn = game.pgn();
        // Nf6 gets ?? and the evaluations are in the PGN, as a board review writes them
        expect(pgn).toMatch(/Nf6 \$4/);
        expect(pgn).toContain("[%eval #1");
        expect(pgn).toContain("[%eval 0.30");
    });

    it("leaves positions without a search result unevaluated", async () => {
        const { game, mistakes } = await reviewGame(
            SCHOLAR,
            async () => undefined,
        );
        expect(mistakes).toEqual({ white: 0, black: 0 });
        // only the final checkmate is known without an engine
        expect(game.pgn()).not.toContain("[%eval 0.30");
    });

    it("gives each search the game behind its position, so repetitions count", async () => {
        const seen: (string[] | undefined)[] = [];
        await reviewGame(SCHOLAR, async (_fen, history) => {
            seen.push(history?.moves);
            return undefined;
        });
        // the start position has no moves behind it; then one more move each time
        expect(seen[0]).toBeUndefined();
        expect(seen[1]).toEqual(["e2e4"]);
        expect(seen[5]).toEqual(["e2e4", "e7e5", "d1h5", "b8c6", "f1c4"]);
    });

    it("grades no book move: a book with the whole line marks no mistake", async () => {
        const everything = async (fen: string) => {
            // every move of the game is in this book
            const sans = ["e4", "e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"];
            const ply = SCRIPT_PLY[fen.split(" ").slice(1, 6).join(" ")];
            return ply === undefined
                ? []
                : [{ uci: "", san: sans[ply], weight: 1 }];
        };
        const { game, mistakes } = await reviewGame(
            SCHOLAR,
            search,
            everything,
        );
        expect(mistakes).toEqual({ white: 0, black: 0 });
        expect(game.pgn()).not.toMatch(/Nf6 \$4/);
    });
});

/** The ply about to be played, by the FEN's fields after the board */
const SCRIPT_PLY: Record<string, number> = {
    "w KQkq - 0 1": 0,
    "b KQkq - 0 1": 1,
    "w KQkq - 0 2": 2,
    "b KQkq - 1 2": 3,
    "w KQkq - 2 3": 4,
    "b KQkq - 3 3": 5,
    "w KQkq - 4 4": 6,
};
