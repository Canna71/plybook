import { describe, expect, it } from "vitest";
import { movesFromText } from "./booktext";
import { makeGame, Path } from "./pgn";

const ITALIAN =
    "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
const diagram = `[SetUp "1"]\n[FEN "${ITALIAN}"]\n\n*\n`;

/** Moves from book text played into a game, as the PDF reader's notes do. */
function addFromText(pgn: string, path: Path, text: string) {
    const g = makeGame(pgn);
    const { moves } = movesFromText(text, g.getPosition(path));
    const [next, end] = g.applyMoves(path, moves);
    return { game: next, end, pgn: next.pgn() };
}

describe("GameModel.applyMoves", () => {
    it("plays several moves in a row", () => {
        const { game } = addFromText(diagram, Path.root, "4.c3 Nf6 5.d4");
        expect(game.mainline.map((p) => p.san)).toEqual(["c3", "Nf6", "d4"]);
    });

    it("continues from a move already played", () => {
        const first = addFromText(diagram, Path.root, "4.c3");
        expect(first.game.mainline.map((p) => p.san)).toEqual(["c3"]);
        const second = addFromText(first.pgn, first.end, "4...Nf6 5.d4");
        expect(second.game.mainline.map((p) => p.san)).toEqual([
            "c3",
            "Nf6",
            "d4",
        ]);
    });
});
