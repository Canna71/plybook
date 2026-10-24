import { describe, expect, it } from "vitest";
import { Chess } from "chessops";
import { parseFen } from "chessops/fen";
import { gameEnd } from "./play";

const position = (fen: string) =>
    Chess.fromSetup(parseFen(fen).unwrap()).unwrap();

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
