import { describe, expect, it } from "vitest";
import { movesFromText } from "./booktext";
import { makeGame, Path } from "./pgn";
import { fromCommentShape } from "../components/common/boardShapes";

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

describe("GameModel.withStartingPosition", () => {
    it("sets the position with the standard SetUp tag only", () => {
        const start =
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        const pgn = makeGame(`[Setup "1"]\n${diagram}`)
            .withStartingPosition(start)
            .pgn();
        expect(pgn).toContain(`[FEN "${start}"]`);
        expect(pgn).toContain('[SetUp "1"]');
        expect(pgn).not.toContain('[Setup "1"]');
    });
});

describe("GameModel.updateClock", () => {
    it("writes the time left on the move, keeping its comment", () => {
        const first = addFromText(diagram, Path.root, "4.c3 Nf6");
        const c3 = first.game.pathAtMainlinePly(1);
        const nf6 = first.game.pathAtMainlinePly(2);
        let game = first.game.insertComment(c3, "A quiet move");
        game = game.updateClock(c3, 295.5).updateClock(nf6, 3723);
        const pgn = game.pgn();
        expect(pgn).toContain("{ A quiet move [%clk 0:04:55.5] }");
        expect(pgn).toContain("[%clk 1:02:03]");
        const back = makeGame(pgn);
        expect(back.mainline.map((p) => p.san)).toEqual(["c3", "Nf6"]);
        expect(back.mainline[0].comments).toEqual(["A quiet move"]);
    });
});

describe("GameModel.updateShapes", () => {
    it("saves a circle as a circle, not an arrow to a1 (U.2)", () => {
        const game = makeGame("1. e4 e5 *");
        const e4 = game.pathAtMainlinePly(1);
        const pgn = game
            .updateShapes(e4, [
                { orig: "c5", brush: "red" },
                { orig: "g1", dest: "f3", brush: "green" },
            ])
            .pgn();
        expect(pgn).toContain("[%csl Rc5]");
        expect(pgn).toContain("[%cal Gg1f3]");
        expect(pgn).not.toContain("a1");
        // and read back as a circle: a shape without a dest on the board
        const back = makeGame(pgn).mainline[0].shapes.map(fromCommentShape);
        expect(back).toEqual([
            { orig: "c5", dest: undefined, brush: "red" },
            { orig: "g1", dest: "f3", brush: "green" },
        ]);
    });
});

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
