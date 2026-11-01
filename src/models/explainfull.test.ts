import { describe, expect, it } from "vitest";
import { explainMoveFull, MIN_DEPTH } from "./explain";

// Engine lines and evaluations are given by hand: these tests check what is said about them,
// not the engine. Evaluations are from White's side, as the app stores them.
const deep = (e: { pawns: number } | { mate: number }) => ({
    ...e,
    depth: 20,
});

/** Words that claim a tactic: none may appear without a line or fact behind it */
const TACTICAL =
    /fork|pin|skewer|discovered|hanging|undefended|wins material|winning (a|the)|mate|threatens/i;

describe("explainMoveFull: tactical positions", () => {
    // 1.e4 d5 2.Qg4?? Bxg4: the queen walks onto the bishop's diagonal
    const QG4 = {
        fenBefore:
            "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2",
        uci: "d1g4",
        verdict: { class: "blunder" as const, loss: 45 },
        bestUci: "e4d5",
        bestPv: ["e4d5", "d8d5", "b1c3"],
        replyPv: ["c8g4", "f1e2", "g4e2"],
        evaluations: {
            before: deep({ pawns: 0.3 }),
            after: deep({ pawns: -8.6 }),
        },
        history: ["rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"],
    };

    it("names the hanging queen, the answer that takes it and the material, with evidence", () => {
        const x = explainMoveFull(QG4)!;
        expect(x.move).toEqual({ uci: "d1g4", san: "Qg4" });
        expect(x.side).toBe("white");
        expect(x.text[0]).toBe(
            "Qg4 is a blunder: it gives away 45% of White's winning chances.",
        );
        expect(x.evidence).toContainEqual({
            text: "leaves the queen on g4 undefended and attacked",
            basis: "board",
            verified: true,
        });
        expect(x.reply).toEqual({ uci: "c8g4", san: "Bxg4" });
        expect(x.text.join(" ")).toContain("Black answers Bxg4");
        expect(x.text.join(" ")).toMatch(/Black wins material/);
        expect(x.best).toEqual({ uci: "e4d5", san: "exd5" });
        expect(x.text.join(" ")).toContain("Better was exd5");
    });

    it("keeps scores on the mover's side and says what kind they are", () => {
        const x = explainMoveFull(QG4)!;
        expect(x.evaluation).toEqual({
            before: { type: "cp", value: 30 },
            after: { type: "cp", value: -860 },
            depth: 20,
            class: "blunder",
            loss: 45,
        });
        expect(x.inconclusive).toBe(false);
    });

    it("shows only lines replayed legally from their positions", () => {
        const x = explainMoveFull(QG4)!;
        expect(x.lines).toEqual([
            {
                label: "reply",
                fen: expect.any(String),
                uci: ["c8g4", "f1e2", "g4e2"],
                san: ["Bxg4", "Be2", "Bxe2"],
                dropped: 0,
            },
            {
                label: "best",
                fen: QG4.fenBefore,
                uci: ["e4d5", "d8d5", "b1c3"],
                san: ["exd5", "Qxd5", "Nc3"],
                dropped: 0,
            },
        ]);
        expect(x.validation).toEqual({ ok: true, problems: [] });
    });

    it("cuts a line at a move that is not legal, and says so", () => {
        // a stale line: its second move belongs to another position
        const x = explainMoveFull({
            ...QG4,
            replyPv: ["c8g4", "e7e5", "g4e2"],
        })!;
        expect(x.lines[0].san).toEqual(["Bxg4"]);
        expect(x.lines[0].dropped).toBe(2);
        expect(x.validation.ok).toBe(false);
        expect(x.validation.problems[0]).toMatch(/not legal/);
    });

    // 1.e4 e5 2.Qh5 Nc6 3.Bc4, Black plays Nf6?? and White mates
    it("names a mate in one, and keeps a mate score as a mate", () => {
        const x = explainMoveFull({
            fenBefore:
                "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3",
            uci: "g8f6",
            verdict: { class: "blunder", loss: 50 },
            replyPv: ["h5f7"],
            evaluations: {
                before: deep({ pawns: -0.2 }),
                after: deep({ mate: 1 }),
            },
            history: [],
        })!;
        expect(x.text.join(" ")).toContain("White answers Qxf7#, checkmate.");
        expect(x.evidence).toContainEqual({
            text: "Qxf7# mates",
            basis: "line",
            verified: true,
            line: "reply",
        });
        // Black moved: White's mate is -1 from Black's side
        expect(x.evaluation.after).toEqual({ type: "mate", value: -1 });
        expect(x.evaluation.before).toEqual({ type: "cp", value: 20 });
    });
});

describe("explainMoveFull: quiet positions claim no tactic", () => {
    it("1.e4: development and the centre, nothing tactical", () => {
        const x = explainMoveFull({
            fenBefore:
                "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
            uci: "e2e4",
            verdict: { class: "best", loss: 0 },
            bestUci: "e2e4",
            bestPv: ["e2e4", "e7e5", "g1f3"],
            replyPv: ["e7e5", "g1f3", "b8c6"],
            evaluations: {
                before: deep({ pawns: 0.2 }),
                after: deep({ pawns: 0.3 }),
            },
            history: [],
        })!;
        expect(x.text.join(" ")).not.toMatch(TACTICAL);
        expect(x.evidence.every((e) => e.basis !== "line")).toBe(true);
        // "takes a share of the centre" is a reading of the position, not a fact
        expect(x.evidence).toContainEqual({
            text: "takes a share of the centre",
            basis: "interpretation",
            verified: false,
        });
    });

    it("a quiet inaccuracy with a quiet answer invents no tactic", () => {
        // Italian, Black plays h6 instead of developing; White answers quietly
        const x = explainMoveFull({
            fenBefore:
                "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQK2R b KQkq - 0 5",
            uci: "h7h6",
            verdict: { class: "inaccuracy", loss: 6 },
            bestUci: "d7d6",
            bestPv: ["d7d6", "e1g1", "e8g8"],
            replyPv: ["e1g1", "d7d6", "b1d2"],
            evaluations: {
                before: deep({ pawns: 0.1 }),
                after: deep({ pawns: 0.4 }),
            },
            history: [],
        })!;
        expect(x.text.join(" ")).not.toMatch(TACTICAL);
        expect(x.text.join(" ")).toContain("Better was d6");
        expect(
            x.evidence.filter((e) => e.verified).map((e) => e.text),
        ).not.toContainEqual(expect.stringMatching(TACTICAL));
    });

    it("a double attack the line does not cash in is not called a fork", () => {
        const x = explainMoveFull({
            fenBefore: "r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1",
            uci: "b5c7",
            verdict: { class: "best", loss: 0 },
            evaluations: {
                before: deep({ pawns: 5 }),
                after: deep({ pawns: 5 }),
            },
            history: [],
        })!;
        expect(x.text.join(" ")).not.toMatch(/fork/);
        expect(x.text.join(" ")).toContain(
            "attacks the king and the rook at once",
        );
    });
});

describe("explainMoveFull: limits", () => {
    const BASE = {
        fenBefore:
            "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 2",
        uci: "d1g4",
        verdict: { class: "blunder" as const, loss: 45 },
        bestUci: "e4d5",
        replyPv: ["c8g4"],
    };

    it("a shallow search judges nothing and offers no better move", () => {
        const shallow = MIN_DEPTH - 2;
        const x = explainMoveFull({
            ...BASE,
            evaluations: {
                before: { pawns: 0.3, depth: shallow },
                after: { pawns: -8.6, depth: shallow },
            },
            history: [],
        })!;
        expect(x.inconclusive).toBe(true);
        expect(x.text[0]).toBe(
            `Qg4: the engine has not searched deep enough to judge it yet (depth ${shallow}).`,
        );
        expect(x.text.join(" ")).not.toContain("Better was");
        expect(x.evaluation.class).toBeUndefined();
        expect(x.limits[0]).toMatch(/preliminary/);
    });

    it("without evaluations the move is not judged, and that is said", () => {
        const x = explainMoveFull({ fenBefore: BASE.fenBefore, uci: "d1g4" })!;
        expect(x.inconclusive).toBe(true);
        expect(x.limits).toContain(
            "No evaluation of both positions: the move is not judged",
        );
        expect(x.limits).toContain(
            "No game history: repetitions are not checked",
        );
    });

    it("a third repetition is a fact from the game, which a FEN cannot show", () => {
        // knights out and back: the starting position comes a third time with Ng8
        const start =
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        const x = explainMoveFull({
            fenBefore:
                "rnbqkb1r/pppppppp/5n2/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 8 5",
            uci: "f6g8",
            history: [start, "x", start],
        })!;
        expect(x.text).toContain(
            "It repeats the position for the third time: a draw can be claimed.",
        );
        expect(x.evidence).toContainEqual({
            text: "repeats the position for the third time: a draw can be claimed",
            basis: "board",
            verified: true,
        });
    });

    it("is undefined for an illegal move", () => {
        expect(
            explainMoveFull({ fenBefore: BASE.fenBefore, uci: "d1d5" }),
        ).toBe(undefined);
    });

    it("notes a position seen before only when the engine had just the FEN", () => {
        // Ng8 brings back the start position, seen once before in this game
        const start =
            "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        const input = {
            fenBefore:
                "rnbqkb1r/pppppppp/5n2/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 4 3",
            uci: "f6g8",
            history: [start, "a", "b"],
        };
        const note = /without the game/;
        expect(explainMoveFull(input)!.limits.join(" ")).toMatch(note);
        expect(
            explainMoveFull({ ...input, engineSawGame: true })!.limits.join(
                " ",
            ),
        ).not.toMatch(note);
    });
});

// the owner's games (F.37a, docs/EXPLANATIONS.md)
describe("explainMoveFull: lines read where they settle", () => {
    it("names no attack that the next move takes back (10...d5 exd5 exd5)", () => {
        const x = explainMoveFull({
            fenBefore:
                "r2q1rk1/ppp3p1/2nppn1p/2b1p3/4P2B/P1NP1N2/1PP2PPP/R2Q1RK1 b - - 1 10",
            uci: "d6d5",
            verdict: { class: "mistake", loss: 10 },
            bestUci: "a7a5",
            bestPv: ["a7a5", "c3e2"],
            replyPv: ["e4d5", "e6d5", "f1e1"],
            evaluations: {
                before: deep({ pawns: -0.66 }),
                after: deep({ pawns: 0.45 }),
            },
        })!;
        expect(x.text.join(" ")).toContain("White answers exd5.");
        expect(x.text.join(" ")).not.toMatch(/attacks the knight/);
        // exd5 exists only because of d5: a5 does not "stop" it (F.37b)
        expect(x.text.join(" ")).not.toMatch(/stops exd5/);
    });

    it("says the material where the exchange ends (12.e5 Qxe3 Bxe3 dxe5)", () => {
        const x = explainMoveFull({
            fenBefore:
                "r3kb1r/pp4pp/1qpppn2/8/4P3/2N1Q3/PPP2PPP/R1B1R1K1 w kq - 0 12",
            uci: "e4e5",
            verdict: { class: "mistake", loss: 12 },
            bestUci: "e3h3",
            bestPv: ["e3h3", "e6e5"],
            replyPv: ["b6e3", "c1e3", "d6e5", "c3b1", "f8d6", "b1d2"],
            evaluations: {
                before: deep({ pawns: 1.18 }),
                after: deep({ pawns: -0.1 }),
            },
        })!;
        const text = x.text.join(" ");
        expect(text).toContain("Black answers Qxe3.");
        expect(text).not.toMatch(/pins the pawn/);
        expect(text).toContain(
            "After Qxe3 Bxe3 dxe5: Black wins material (+1).",
        );
        // the queen trade was on before e5, and Qh3 takes it away (F.37b)
        expect(text).toContain("Better was Qh3: it stops Qxe3.");
    });

    it("gives the better move its threat when nothing else explains it", () => {
        // 10...d5 again: a5's threat, as the threat search would find it (made up here)
        const x = explainMoveFull({
            fenBefore:
                "r2q1rk1/ppp3p1/2nppn1p/2b1p3/4P2B/P1NP1N2/1PP2PPP/R2Q1RK1 b - - 1 10",
            uci: "d6d5",
            verdict: { class: "mistake", loss: 10 },
            bestUci: "a7a5",
            bestPv: ["a7a5", "c3e2"],
            replyPv: ["e4d5", "e6d5"],
            bestThreats: {
                created: { side: "black", san: "a4", gain: 1, mates: false },
            },
            evaluations: {
                before: deep({ pawns: -0.66 }),
                after: deep({ pawns: 0.45 }),
            },
        })!;
        expect(x.text.join(" ")).toContain(
            "Better was a5: it threatens a4, winning a pawn.",
        );
        expect(x.evidence).toContainEqual({
            text: "a5 threatens a4, winning a pawn",
            basis: "line",
            verified: true,
            line: undefined,
        });
    });

    it("compares the two futures: the queens off against a king in the centre (9.Re1)", () => {
        const x = explainMoveFull({
            fenBefore:
                "r2qkb1r/pp1b1ppp/2pp1n2/8/2BQP3/2N5/PPP2PPP/R1B2RK1 w kq - 0 9",
            uci: "f1e1",
            verdict: { class: "inaccuracy", loss: 7 },
            bestUci: "e4e5",
            bestPv: ["e4e5", "d6e5", "d4e5", "d8e7", "e5g3", "d7e6"],
            replyPv: ["d8b6", "c1e3", "b6d4", "e3d4", "f6h5", "g2g3"],
            evaluations: {
                before: deep({ pawns: 1.76 }),
                after: deep({ pawns: 0.96 }),
            },
        })!;
        const text = x.text.join(" ");
        expect(text).toContain(
            "It lets Black trade queens (Qxd4) while Black's king is still in the centre.",
        );
        expect(text).toContain(
            "Better was e5: it keeps the queens on against Black's king in the centre.",
        );
        // readings, not facts
        expect(x.evidence).toContainEqual({
            text: "keeps the queens on against Black's king in the centre",
            basis: "interpretation",
            verified: false,
        });
    });

    it("claims no material the engine's score does not bear out (4.Nc3's better d5)", () => {
        // the line takes a knight on e4 that the engine expects back: +3 against a score of 1.2
        const x = explainMoveFull({
            fenBefore:
                "r1bqkb1r/pppp1ppp/2n2n2/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 1 4",
            uci: "b1c3",
            verdict: { class: "mistake", loss: 11 },
            bestUci: "d4d5",
            bestPv: ["d4d5", "c6b8", "f3e5", "f6e4", "d1e2", "d8e7", "e2e4"],
            replyPv: ["e5d4", "f3d4"],
            evaluations: {
                before: deep({ pawns: 1.22 }),
                after: deep({ pawns: 0.02 }),
            },
        })!;
        expect(x.text.join(" ")).not.toMatch(/\+3/);
    });
});
