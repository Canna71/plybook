import { describe, expect, it } from "vitest";
import { Chess } from "chessops";
import { parseFen } from "chessops/fen";
import {
    movesFromText,
    normalizeChessText,
    textNearDiagram,
    turnFromText,
} from "./booktext";

// the Italian after 3...Bc5, White to move
const ITALIAN =
    "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
const position = (fen: string) =>
    Chess.fromSetup(parseFen(fen).unwrap()).unwrap();

describe("turnFromText", () => {
    it("reads captions", () => {
        expect(turnFromText("Diagram 12: White to play and win")).toBe("white");
        expect(turnFromText("Black to move")).toBe("black");
        expect(turnFromText("What should Black play here?")).toBeUndefined();
    });

    it("reads the first move number", () => {
        expect(turnFromText("Now 12...Nf6 is best")).toBe("black");
        expect(turnFromText("12 … ♘f6")).toBe("black");
        expect(turnFromText("After 13.Bd3 White is better")).toBe("white");
    });
});

describe("movesFromText", () => {
    const sans = (text: string, fen = ITALIAN) =>
        movesFromText(text, position(fen)).sans;

    it("plays the line that follows the diagram", () => {
        expect(
            sans("Here 4.c3 Nf6 5.d4 exd4 6.cxd4 is the main line."),
        ).toEqual(["c3", "Nf6", "d4", "exd4", "cxd4"]);
    });

    it("reads figurines, castling with zeros and evaluation signs", () => {
        expect(sans("4.0-0 ♘f6! 5.d3 d6 +=")).toEqual([
            "O-O",
            "Nf6",
            "d3",
            "d6",
        ]);
    });

    it("leaves out bracketed side lines", () => {
        expect(sans("4.c3 Nf6 (4...d6 5.d4) 5.d4 exd4")).toEqual([
            "c3",
            "Nf6",
            "d4",
            "exd4",
        ]);
    });

    it("stops at prose, so squares in sentences are not moves", () => {
        expect(sans("4.c3 Nf6 and the pawn on d4 is coming")).toEqual([
            "c3",
            "Nf6",
        ]);
    });

    it("stops at a move number that does not fit", () => {
        expect(sans("4.c3 4...Nf6 5.d4")).toEqual(["c3", "Nf6", "d4"]);
        // "5." says White, but it is Black's move after 4.c3
        expect(sans("4.c3 5.Nf6 d4")).toEqual(["c3"]);
    });

    it("finds nothing when no move fits the position", () => {
        expect(sans("1.e4 e5 2.Nf3")).toEqual([]);
    });

    it("normalizes text", () => {
        expect(normalizeChessText("12…♕xd4 0-0-0 – ")).toBe(
            "12...Qxd4 O-O-O - ",
        );
    });
});

describe("textNearDiagram", () => {
    const box = { x0: 0.3, y0: 0.2, x1: 0.7, y1: 0.5 };
    const item = (str: string, x0: number, y0: number) => ({
        str,
        x0,
        y0,
        x1: x0 + 0.1,
        y1: y0 + 0.01,
    });

    it("finds the caption below and the text that follows, in its column", () => {
        const near = textNearDiagram(
            [
                item("above the diagram", 0.3, 0.1),
                item("play", 0.42, 0.52),
                item("White to", 0.32, 0.52),
                item("4.c3 Nf6", 0.3, 0.6),
                item("other column", 0.8, 0.6),
                item("far below", 0.3, 0.95),
            ],
            box,
        );
        expect(near.caption).toBe("White to play");
        expect(near.following).toBe("White to play 4.c3 Nf6");
    });
});
