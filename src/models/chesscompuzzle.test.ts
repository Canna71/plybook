import { describe, expect, it } from "vitest";
import { chesscomPuzzlePgn, isPuzzleOf } from "./chesscompuzzle";
import { makeGame } from "./pgn";
import { parsePasted } from "../paste/pasted";

// as api.chess.com/pub/puzzle gave it on 2026-10-31
const PUZZLE = {
    title: "Haunting Knightmare 🎃",
    url: "https://www.chess.com/daily/2026-10-31",
    fen: "8/8/3K4/8/1N3N2/8/1ppppp2/b2k2n1 w - - 0 1",
    pgn: '[White "William Shinkman"]\n[Black "Study 1872"]\n[Result "*"]\n[FEN "8/8/3K4/8/1N3N2/8/1ppppp2/b2k2n1 w - - 0 1"]\n\n1. Nfd5 Nf3 2. Nd3 e1=Q 3. Nc3# *',
};

// the result shared from the site
const SHARED = `Haunting Knightmare 🎃
https://www.chess.com/daily/2026-10-31

🖤🖤🖤🖤🖤 Keep Practicing

⬜🟩⬜🟩⬜🟩⬜🟩
⚫⬜🟩👑🟩⬜⚫⬜`;

describe("chess.com daily puzzle", () => {
    it("is recognised in a shared result or as its link", () => {
        expect(parsePasted(SHARED)).toEqual({
            kind: "chesscomDaily",
            url: "https://www.chess.com/daily/2026-10-31",
        });
        expect(parsePasted("chess.com/daily/2026-10-31")).toBeUndefined();
        expect(parsePasted("https://chess.com/daily/2026-10-31")).toEqual({
            kind: "chesscomDaily",
            url: "https://www.chess.com/daily/2026-10-31",
        });
    });

    it("becomes a puzzle for the side to move, with its solution", () => {
        const game = makeGame(chesscomPuzzlePgn(PUZZLE)!);
        expect(game.headers.get("Orientation")).toBe("white");
        expect(game.headers.get("Event")).toContain("Haunting Knightmare");
        expect(game.initial.fen).toBe(PUZZLE.fen);
        expect(game.mainline.map((p) => p.san)).toEqual([
            "Nfd5",
            "Nf3",
            "Nd3",
            "e1=Q",
            "Nc3#",
        ]);
    });

    it("tells today's puzzle from another day's link", () => {
        expect(
            isPuzzleOf(PUZZLE, "https://www.chess.com/daily/2026-10-31"),
        ).toBe(true);
        expect(
            isPuzzleOf(PUZZLE, "https://www.chess.com/daily/2026-10-30"),
        ).toBe(false);
    });
});
