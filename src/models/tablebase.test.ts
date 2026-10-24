import { describe, expect, it } from "vitest";
import {
    moveLabel,
    moveOutcome,
    outcome,
    pieceCount,
    Tablebase,
    verdict,
} from "./tablebase";

// King and rook against king, as the Lichess tablebase answers it (trimmed)
const KRK: Tablebase = {
    category: "win",
    dtz: null,
    dtm: null,
    checkmate: false,
    stalemate: false,
    moves: [
        { uci: "a1a7", san: "Ra7", category: "loss", dtz: -22, dtm: -22 },
        { uci: "e1d2", san: "Kd2", category: "loss", dtz: -26, dtm: -26 },
        { uci: "a1a8", san: "Ra8+", category: "loss", dtz: -24, dtm: -24 },
        { uci: "e1f1", san: "Kf1", category: "draw" },
    ],
};

describe("tablebase", () => {
    it("counts pieces", () => {
        expect(pieceCount("4k3/8/8/8/8/8/8/R3K3 w Q - 0 1")).toBe(3);
    });

    it("words the result for the side to move", () => {
        expect(verdict(KRK, "white")).toBe("White wins: mate in 11");
        expect(verdict({ ...KRK, category: "loss" }, "white")).toBe(
            "Black wins: mate in 11",
        );
        expect(verdict({ ...KRK, category: "draw", moves: [] }, "black")).toBe(
            "Draw",
        );
        expect(verdict({ ...KRK, category: "cursed-win" }, "white")).toContain(
            "50-move rule",
        );
        expect(verdict({ ...KRK, checkmate: true, moves: [] }, "black")).toBe(
            "Checkmate: White won",
        );
    });

    it("turns each move's result to the side that plays it", () => {
        expect(moveOutcome(KRK.moves[0])).toBe("win");
        expect(moveLabel(KRK.moves[0])).toBe("wins, mate in 11");
        expect(moveLabel(KRK.moves[3])).toBe("draws");
        expect(moveLabel({ uci: "a", san: "a", category: "win", dtm: 9 })).toBe(
            "loses, mated in 5",
        );
    });

    it("treats 50-move-rule results as draws", () => {
        expect(outcome("cursed-win")).toBe("draw");
        expect(outcome("blessed-loss")).toBe("draw");
        expect(outcome("maybe-win")).toBe("win");
        expect(outcome("nonsense")).toBe("unknown");
    });
});
