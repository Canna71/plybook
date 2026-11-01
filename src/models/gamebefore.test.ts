import { describe, expect, it } from "vitest";
import { Chess } from "chessops";
import { makeBoardFen } from "chessops/fen";
import { makeSanAndPlay, parseSan } from "chessops/san";
import { gameBefore, readingOrder, textMoves } from "./gamebefore";
import { TextItem } from "./booktext";

/** The board after `sans` from the start, and the SAN a found game plays. */
function boardAfter(sans: string): string {
    const pos = Chess.default();
    for (const san of sans.split(" ")) pos.play(parseSan(pos, san)!);
    return makeBoardFen(pos.board);
}
function sans(text: string, board: string): string | undefined {
    const moves = gameBefore(text, board);
    if (!moves) return undefined;
    const pos = Chess.default();
    return moves.map((m) => makeSanAndPlay(pos, m)).join(" ");
}

// Excerpts of an OCR'd book (Collins, Understanding the Chess Openings): knights come out as
// "tlJ", "ltJ", "t'lJ", bishops as "i.", queens as "'iV", 5 as "S", 10 as "1 0".
const HEADER =
    "Giuoco Pian o 1 e4 e5 2 t'lJf3 tlJc6 3 i.c4 i.cS(D) w This is the Giuoco Piano.";
const MOLLER =
    "Meller Attack 1 e4 e5 2 tlJf3 tlJc6 3 i.c4 i.cS Note that 3 ... tlJd4 can be profitably " +
    "met by either 4 tlJxd4 or 4 c3, but not 4 tlJxe5 ?? when 4 ... 'ifg5 ! is already winning " +
    "for Black ! 5 tlJxf7 (5 i.xf7+ cJile7 is no real improvement for White) 5 .. .'i!Vxg2 6 " +
    "l:lfl 'i!fxe4+ 7 i.e2 t'lJf3#. 4 c3(D) B A natural reaction to Black's last move. " +
    "4 • . . tlJf6! Highlighting the disadvantage of the pawn. 4 ... d6 is OK but allows " +
    "White to achieve all his central goals: after 5 d4 exd4 (5 . . . i.b6 6 dxe5 costs " +
    "Black a pawn) 6 cxd4 i.b4+ 7 tlJc3 t'lJf6 8 0-0 ! 0-0 (8 . . . i.xc3? 9 bxc3 ltJxe4 is " +
    "far too risky: after 1 0 d5 ltJe7 1 1 �d4 ltJf6 1 2 i.g5 White's compensation is " +
    "overwhelming) 9 i.g5 Black has no real compensation. 4 ...'iVe7 5 d4 i.b6 is another " +
    "playable line. S d4 While this is the most ambitious move. 5 d3 is the Giuoco " +
    "Pianissimo - Black has no problems after 5 . . . 0-0 6 0-0 a6 7 ltJbd2 i.a7 8 l:te 1 " +
    "d6. S • . • exd4(D) w 6 cxd4";

describe("textMoves", () => {
    it("numbers moves, OCR junk and all", () => {
        const moves = textMoves(HEADER);
        expect(moves.map((m) => m.ply)).toEqual([1, 2, 3, 4, 5, 6]);
        expect(moves[2]).toMatchObject({ to: 21, capture: false }); // Nf3: a piece
        expect(moves[2].pawn).toBeUndefined();
        expect(moves[5].to).toBe(34); // "cS" is c5
    });
    it("leaves out moves without a number and prose", () => {
        expect(textMoves("pressure on e4 with ...d5 and Nf3")).toEqual([]);
    });
    it("reads a rook's square split in two and castling with zeros", () => {
        const moves = textMoves("8 l:te 1 d6 9 0-0");
        expect(moves.map((m) => [m.ply, m.to ?? m.castle])).toEqual([
            [15, 4],
            [16, 43],
            [17, "O-O"],
        ]);
    });
});

describe("gameBefore", () => {
    it("finds the line printed above the diagram", () => {
        expect(sans(HEADER, boardAfter("e4 e5 Nf3 Nc6 Bc4 Bc5"))).toBe(
            "e4 e5 Nf3 Nc6 Bc4 Bc5",
        );
    });
    it("follows the main line through the notes, to the move marked (D)", () => {
        expect(
            sans(MOLLER, boardAfter("e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4")),
        ).toBe("e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4");
        expect(sans(MOLLER, boardAfter("e4 e5 Nf3 Nc6 Bc4 Bc5 c3"))).toBe(
            "e4 e5 Nf3 Nc6 Bc4 Bc5 c3",
        );
    });
    it("plays side lines in the notes when they lead to the diagram", () => {
        expect(
            sans(
                MOLLER,
                boardAfter(
                    "e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 O-O O-O a6 Nbd2 Ba7 Re1 d6",
                ),
            ),
        ).toBe("e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 O-O O-O a6 Nbd2 Ba7 Re1 d6");
    });
    it("gives nothing when no line in the text reaches the diagram", () => {
        expect(gameBefore(MOLLER, boardAfter("d4 d5 c4 e6"))).toBeUndefined();
        expect(gameBefore("", boardAfter("e4"))).toBeUndefined();
    });
});

describe("readingOrder", () => {
    const item = (
        str: string,
        x0: number,
        y0: number,
        x1 = x0 + 0.05,
    ): TextItem => ({
        str,
        x0,
        y0,
        x1,
        y1: y0 + 0.015,
    });
    const rightColumn = [0.2, 0.3, 0.4, 0.5, 0.6].map((y) =>
        item(`r${y}`, 0.52, y),
    );

    it("reads the left column, then the right, and joins runs that touch", () => {
        const text = readingOrder([
            ...rightColumn,
            // gaps as measured in that book: 0.006 between words, none inside a move
            item("1 e4 e5 2", 0.06, 0.2, 0.146),
            item("t'lJ", 0.152, 0.2, 0.173),
            item("f3", 0.173, 0.2),
            item("left2", 0.06, 0.3),
        ]);
        expect(text).toBe("1 e4 e5 2 t'lJf3 left2 r0.2 r0.3 r0.4 r0.5 r0.6");
    });
    it("stops at a diagram: its column's text above it, and the columns before", () => {
        const text = readingOrder([...rightColumn, item("left", 0.06, 0.7)], {
            x0: 0.52,
            y0: 0.45,
            x1: 0.9,
            y1: 0.7,
        });
        expect(text).toBe("left r0.2 r0.3 r0.4");
    });
});
