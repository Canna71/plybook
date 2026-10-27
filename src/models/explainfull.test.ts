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
});
