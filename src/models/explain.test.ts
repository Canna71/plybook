import { describe, expect, it } from "vitest";
import { explainMove } from "./explain";

describe("explainMove", () => {
    it("explains a blunder that allows mate and names the better move", () => {
        // Black to move against the Scholar's mate set-up
        const text = explainMove({
            fenBefore:
                "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3",
            uci: "g8f6",
            verdict: { class: "blunder", loss: 47 },
            bestUci: "g7g6",
            replyPv: ["h5f7"],
        });
        expect(text).toEqual([
            "Nf6 is a blunder: it gives away 47% of Black's winning chances.",
            "White answers Qxf7#, checkmate.",
            "Better was g6: it attacks the undefended queen on h5.",
        ]);
    });

    it("explains a piece left hanging and where the reply leads", () => {
        // after 1. e4 d5, Qg4?? puts the queen where the c8 bishop takes it
        const text = explainMove({
            fenBefore:
                "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2",
            uci: "d1g4",
            verdict: { class: "blunder", loss: 40 },
            bestUci: "e4d5",
            bestPv: ["e4d5", "d8d5"],
            replyPv: ["c8g4", "f2f3"],
        });
        expect(text).toEqual([
            "Qg4 is a blunder: it gives away 40% of White's winning chances.",
            "It leaves the queen on g4 undefended and attacked.",
            "Black answers Bxg4.",
            "After Bxg4 f3: Black wins material (+9).",
            "Better was exd5.",
        ]);
    });

    it("says what a good move achieves", () => {
        expect(
            explainMove({
                fenBefore: "r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1",
                uci: "b5c7",
                verdict: { class: "best", loss: 0 },
            }),
        ).toEqual([
            "Nc7+ is the engine's choice.",
            "It gives check and forks the king and the rook with the knight on c7.",
        ]);
    });

    it("does not call an even exchange a weakness, nor a pawn left loose", () => {
        // 1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6: the bishop on c6 can be taken back
        const text = explainMove({
            fenBefore:
                "r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4",
            uci: "b5c6",
            verdict: { class: "mistake", loss: 11 },
        });
        expect(text).toEqual([
            "Bxc6 is a mistake: it gives away 11% of White's winning chances.",
        ]);
    });

    it("keeps pawn moves in lower case", () => {
        const [first] = explainMove({
            fenBefore:
                "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            uci: "d2d4",
            verdict: { class: "good", loss: 0 },
        });
        expect(first).toBe("d4 is a good move.");
    });

    it("needs a legal move", () => {
        expect(
            explainMove({
                fenBefore:
                    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                uci: "e2e5",
            }),
        ).toEqual([]);
    });
});
