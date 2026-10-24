import { describe, expect, it } from "vitest";
import { makeGame } from "./pgn";
import { mainline, reviewLine } from "./review";
import { mistakePuzzles, playerSide, trainableMistakes } from "./mistakes";

// Black's 3... Nf6?? allows mate; the engine preferred 3... g6
const GAME =
    '[White "Thibault"]\n[Black "me"]\n[Date "2026.10.22"]\n' +
    '[Site "https://lichess.org/abcd"]\n\n' +
    "1. e4 {[%eval 0.2,20,e7e5]} e5 {[%eval 0.2,20,d1h5]} 2. Qh5 {[%eval 0.0,20,b8c6]} " +
    "Nc6 {[%eval 0.0,20,f1c4]} 3. Bc4 {[%eval 0.0,20,g7g6]} Nf6 {[%eval #1,20,h5f7]} 4. Qxf7# 1-0";

const reviewed = () => reviewLine(mainline(makeGame(GAME)));
const info = {
    white: "Thibault",
    black: "me",
    date: "2026.10.22",
    site: "https://lichess.org/abcd",
};

describe("playerSide", () => {
    it("matches names without case", () => {
        expect(playerSide(info, ["ME"])).toBe("black");
        expect(playerSide(info, ["thibault"])).toBe("white");
        expect(playerSide(info, ["Player"])).toBeUndefined();
    });
});

describe("mistakePuzzles", () => {
    it("only uses the side's mistakes and blunders with a better move", () => {
        expect(trainableMistakes(reviewed(), "white")).toEqual([]);
        expect(
            trainableMistakes(reviewed(), "black").map((m) => m.san),
        ).toEqual(["Nf6"]);
    });

    it("builds a puzzle from the position before the mistake", () => {
        const [puzzle, ...rest] = mistakePuzzles(reviewed(), info, "black");
        expect(rest).toEqual([]);
        expect(puzzle.name).toBe("2026.10.22 Thibault vs me 3... Nf6");
        expect(puzzle.weight).toBe(400);

        // the puzzle is a valid game: the better move is the only line
        const game = makeGame(puzzle.pgn);
        expect(game.initial.pos.turn).toBe("black");
        expect(game.mainline.map((p) => p.san)).toEqual(["g6"]);
        expect(game.headers.get("Site")).toBe("https://lichess.org/abcd");
        expect(puzzle.pgn).toContain("In the game you played 3... Nf6");
    });

    it("keeps names file-safe and headers escaped", () => {
        const [puzzle] = mistakePuzzles(
            reviewed(),
            { ...info, white: 'A/B "C"' },
            "black",
        );
        expect(puzzle.name).not.toMatch(/[\\/:*?"<>|]/);
        expect(makeGame(puzzle.pgn).headers.get("White")).toBe('A/B "C"');
    });
});
