import { describe, expect, it } from "vitest";
import { makeGame } from "./pgn";
import {
    bookQuote,
    collectionName,
    diagramFileName,
    diagramPgn,
    normalPgn,
    notesStart,
    restartedNotes,
    withOrientation,
} from "./scancollection";

// Black to move in the Italian: ...Nf6 is the engine's choice
const FEN =
    "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 5 3";

describe("scanned collections", () => {
    it("names folders and files in book order", () => {
        expect(collectionName("Chess Tactics: Book 1.pdf")).toBe(
            "Chess Tactics- Book 1",
        );
        expect(collectionName(".pdf")).toBe("Scanned book");
        expect(diagramFileName({ page: 12, index: 2, fen: FEN })).toBe(
            "p012-2.pgn",
        );
    });

    it("writes a position to study", () => {
        const game = makeGame(
            diagramPgn("Tactics", { page: 3, index: 1, fen: FEN }),
        );
        expect(game.initial.fen).toBe(FEN);
        expect(game.mainline).toHaveLength(0);
        expect(game.headers.get("Event")).toBe("Tactics, page 3");
    });

    it("writes the engine's solution as the moves", () => {
        const pgn = diagramPgn("Tactics", {
            page: 3,
            index: 1,
            fen: FEN,
            solution: ["g8f6", "d2d3"],
        });
        expect(pgn).toContain("3... Nf6 4. d3 *");
        const game = makeGame(pgn);
        expect(game.mainline.map((p) => p.san)).toEqual(["Nf6", "d3"]);
    });

    it("quotes book text on one line, with its page", () => {
        expect(
            bookQuote("White's bishop on c4\n eyes the weak f7-\nsquare.", 30),
        ).toBe("White's bishop on c4 eyes the weak f7-square. (p. 30)");
        expect(bookQuote("The open-\ning is sharp", 2)).toBe(
            "The opening is sharp (p. 2)",
        );
        expect(bookQuote("  \n ", 2)).toBe("");
    });

    it("compares games however they were spaced", () => {
        const pgn = diagramPgn("T", {
            page: 1,
            index: 1,
            fen: FEN,
            solution: ["g8f6", "d2d3"],
        });
        const respaced = pgn
            .replace(/\n\n/, "\n\n\n")
            .replace("Nf6 4.", "Nf6  4.");
        expect(normalPgn(respaced)).toBe(normalPgn(pgn));
        expect(normalPgn(pgn.replace("d3", "d4"))).not.toBe(normalPgn(pgn));
    });

    it("keeps the printed orientation, so the board doesn't turn with the side to move", () => {
        const pgn = diagramPgn("T", {
            page: 1,
            index: 1,
            fen: FEN,
            orientation: "white",
        });
        expect(makeGame(pgn).headers.get("Orientation")).toBe("white");
        const old = diagramPgn("T", { page: 1, index: 1, fen: FEN });
        expect(
            makeGame(withOrientation(old, "black")).headers.get("Orientation"),
        ).toBe("black");
        expect(withOrientation(pgn, "black")).toBe(pgn);
    });

    it("starts notes without moves again from the other side", () => {
        const white = FEN.replace(" b ", " w ");
        const notes = diagramPgn("T", { page: 1, index: 1, fen: FEN }).replace(
            "*",
            "{ Rubinstein's idea } *",
        );
        expect(notesStart(notes)).toEqual({ turn: "black", moves: false });
        const restarted = restartedNotes(notes, white, "white")!;
        expect(notesStart(restarted)).toEqual({ turn: "white", moves: false });
        expect(restarted).toContain("Rubinstein's idea");
        expect(makeGame(restarted).headers.get("Orientation")).toBe("white");

        const withMoves = diagramPgn("T", {
            page: 1,
            index: 1,
            fen: FEN,
            solution: ["g8f6"],
        });
        expect(notesStart(withMoves).moves).toBe(true);
        expect(restartedNotes(withMoves, white)).toBeUndefined();
    });

    it("stops the solution at a move that does not fit", () => {
        const pgn = diagramPgn("T", {
            page: 1,
            index: 1,
            fen: FEN,
            solution: ["g8f6", "a1a8"],
        });
        expect(makeGame(pgn).mainline.map((p) => p.san)).toEqual(["Nf6"]);
    });
});
