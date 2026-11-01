import { describe, expect, it } from "vitest";
import { explainMove } from "./explain";
import { lineIdea, Prevented } from "../reasons/threats";

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
            "Black answers Bxg4, winning the queen on g4, which nothing defends.",
            "After Bxg4: Black wins material (+9).",
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
            // no line here shows the rook won: a double attack, not yet a fork
            "It gives check and attacks the king and the rook at once with the knight on c7.",
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

    it("says what a move stops and what it threatens", () => {
        // 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5: Black's Qe7 stops Nxf7 (a fork);
        // White's Ng5 threatens it
        const afterNg5 =
            "r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4";
        const passedAfterNg5 =
            "r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R w KQkq - 5 5";
        const fork = lineIdea(passedAfterNg5, ["g5f7", "d8e7", "f7h8"])!;
        expect(
            explainMove({
                fenBefore: afterNg5,
                uci: "d8e7",
                verdict: { class: "good", loss: 2 },
                threats: { stopped: fork },
            }),
        ).toContain(
            "It stops Nxf7, a fork of the queen on d8 and the rook on h8.",
        );
        expect(
            explainMove({
                fenBefore:
                    "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
                uci: "f3g5",
                verdict: { class: "best", loss: 0 },
                threats: { created: fork },
            }),
        ).toContain(
            "It threatens Nxf7, a fork of the queen on d8 and the rook on h8.",
        );
    });

    it("says what a pawn move prevents (prophylaxis), only the pawn kind", () => {
        // Italian, 5...d6: h3 takes g4 from the bishop
        const fenBefore =
            "r1bqk2r/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQK2R w KQkq - 0 6";
        const say = (prevented: Prevented) =>
            explainMove({
                fenBefore,
                uci: "h2h3",
                verdict: { class: "good", loss: 1 },
                threats: { prevented },
            }).join(" ");
        const bg4: Prevented = {
            san: "Bg4",
            how: "pawn",
            square: "g4",
            role: "bishop",
            pawn: "h3",
        };
        expect(say(bg4)).toContain(
            "prevents Bg4: the pawn on h3 would take the bishop",
        );
        expect(say({ ...bg4, how: "illegal", pawn: undefined })).not.toContain(
            "prevents",
        );
    });

    it("says when the move played was the only good one, from two engine lines", () => {
        const fenBefore =
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        const alternatives = (depth: number) => [
            { pv: ["e2e4"], score: { type: "cp" as const, value: 30 }, depth },
            {
                pv: ["d2d4"],
                score: { type: "cp" as const, value: -200 },
                depth,
            },
        ];
        const evaluations = {
            before: { pawns: 0.3, depth: 16 },
            after: { pawns: 0.3, depth: 16 },
        };
        const say = (uci: string, depth: number, cls: "best" | "mistake") =>
            explainMove({
                fenBefore,
                uci,
                verdict: { class: cls, loss: cls === "best" ? 0 : 12 },
                alternatives: alternatives(depth),
                evaluations,
            }).join(" ");
        expect(say("e2e4", 16, "best")).toMatch(
            /It is the only move that keeps the balance: every other move gives away at least \d+% of White's winning chances \(the next best is d4\)\./,
        );
        // a mistake: only the engine's move kept the balance
        expect(say("g2g4", 16, "mistake")).toMatch(
            /Only e4 kept the balance: every other move gives away at least \d+%/,
        );
        // too shallow to say
        expect(say("e2e4", 8, "best")).not.toContain("only move");
    });

    it("names a sacrifice, played or missed", () => {
        // the Greek gift (Lichess game, 2013): Bxh7+ Kxh7 Ng5+
        const fenBefore =
            "rn1qnrk1/pb2bppp/1p1pp3/2p1P3/3P1P1P/3B1N2/PPP1Q1P1/RNB1K2R w KQ - 0 10";
        const line = "d3h7 g8h7 f3g5 h7g8 e2h5 b7e4 g5e4 d6e5".split(" ");
        const evaluations = {
            before: { pawns: 1.5, depth: 16 },
            after: { pawns: 1.5, depth: 16 },
        };
        const played = explainMove({
            fenBefore,
            uci: "d3h7",
            verdict: { class: "best", loss: 0 },
            replyPv: line.slice(1),
            evaluations,
        }).join(" ");
        expect(played).toContain(
            "It sacrifices the bishop on h7, and the engine's line wins the material back.",
        );
        const missed = explainMove({
            fenBefore,
            uci: "a2a3",
            verdict: { class: "mistake", loss: 12 },
            bestUci: "d3h7",
            bestPv: line,
            evaluations,
        }).join(" ");
        expect(missed).toContain(
            "Better was Bxh7+: it sacrifices the bishop on h7, and the engine's line wins the material back.",
        );
    });

    it("names what the opponent's answer does", () => {
        // the same position, but Black plays a6 and allows the fork: Nxf7 was the point
        const text = explainMove({
            fenBefore:
                "r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4",
            uci: "a7a6",
            verdict: { class: "blunder", loss: 30 },
            replyPv: ["g5f7", "d8e7", "f7h8"],
        });
        expect(text).toContain(
            "White answers Nxf7, a fork of the queen on d8 and the rook on h8.",
        );
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
