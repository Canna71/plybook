import { describe, expect, it } from "vitest";
import { Chess } from "chessops";
import { parseFen } from "chessops/fen";
import { gameEnd, timeoutEnd } from "./play";

const position = (fen: string) =>
    Chess.fromSetup(parseFen(fen).unwrap()).unwrap();

describe("timeoutEnd", () => {
    const start = position(
        "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );

    it("gives the game to the other side", () => {
        const lost = timeoutEnd(start, "white", "black");
        expect(lost.result).toBe("0-1");
        expect(lost.icon).toBe("failure");
        const won = timeoutEnd(start, "black", "black");
        expect(won.result).toBe("1-0");
        expect(won.icon).toBe("success");
    });

    it("is a draw when the other side cannot checkmate", () => {
        // the engine (Black) has a bare king: White's flag falls, but it's a draw
        const bareKing = position("4k3/8/8/8/8/8/PPPP4/4K3 w - - 0 1");
        expect(timeoutEnd(bareKing, "white", "black").result).toBe("1/2-1/2");
    });
});

describe("gameEnd", () => {
    // Black is checkmated (fool's mate reversed: 1. f3 e5 2. g4 Qh4#)
    const whiteMated = position(
        "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
    );

    it("is undefined while the game goes on", () => {
        expect(
            gameEnd(
                position(
                    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                ),
            ),
        ).toBeUndefined();
    });

    it("reports a loss when the engine mates the player", () => {
        expect(gameEnd(whiteMated, "black")).toMatchObject({
            result: "0-1",
            title: "Checkmate",
            message: "You lost the game",
            icon: "failure",
        });
    });

    it("reports a win when the player mates the engine", () => {
        expect(gameEnd(whiteMated, "white")).toMatchObject({
            result: "0-1",
            message: "You won the game",
            icon: "success",
        });
    });

    it("reports stalemate and insufficient material as draws", () => {
        expect(
            gameEnd(position("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")),
        ).toMatchObject({
            result: "1/2-1/2",
            title: "Draw",
            message: "Stalemate",
        });
        expect(gameEnd(position("7k/8/6K1/8/8/8/8/8 b - - 0 1"))).toMatchObject(
            {
                result: "1/2-1/2",
                message: "Neither side can checkmate",
            },
        );
    });
});
