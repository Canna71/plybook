import { describe, expect, it } from "vitest";
import {
    coachBrief,
    inventedChess,
    inventedClaims,
    rewordingProblems,
} from "./coach";
import { explainMoveFull } from "./explain";

describe("coachBrief (F.37d)", () => {
    // 12.e5 in the owner's game: the queens come off, then dxe5
    const x = explainMoveFull({
        fenBefore:
            "r3kb1r/pp4pp/1qpppn2/8/4P3/2N1Q3/PPP2PPP/R1B1R1K1 w kq - 0 12",
        uci: "e4e5",
        verdict: { class: "mistake", loss: 12 },
        bestUci: "e3h3",
        bestPv: ["e3h3", "e6e5", "h3e6"],
        replyPv: ["b6e3", "c1e3", "d6e5", "c3b1"],
        evaluations: {
            before: { pawns: 1.18, depth: 20 },
            after: { pawns: -0.1, depth: 20 },
        },
    })!;
    const brief = coachBrief(x);

    it("gives the model the explanation, the evidence and the engine lines", () => {
        expect(brief).toContain(`Explanation: ${x.text.join(" ")}`);
        expect(brief).toContain("(a reading, not certain)");
        expect(brief).toContain("The answer to e5: Qxe3 Bxe3 dxe5 Nb1");
        expect(brief).toContain("The better line: Qh3 e5 Qe6+");
    });

    it("lets the coach name a move of the lines, never one of its own", () => {
        expect(
            rewordingProblems(
                brief,
                "After e5 the queens come off with Qxe3, and Black's e-pawn takes on e5; Qh3 keeps the queens and eyes e6 with Qe6+.",
            ),
        ).toEqual([]);
        expect(
            rewordingProblems(brief, "Qh3 and then Bg5 would be strong."),
        ).toEqual(["Bg5"]);
    });
});

describe("inventedClaims", () => {
    const ORIGINAL =
        "Nc7+ is the engine's choice. It gives check and attacks the king and the rook at once with the knight on c7.";

    it("lets a rewording say the same things", () => {
        expect(
            inventedClaims(
                ORIGINAL,
                "Nc7+ checks the king and hits the rook at the same time.",
            ),
        ).toEqual([]);
    });

    it("flags a fork, a win or a mate the explanation does not claim", () => {
        expect(
            inventedClaims(
                ORIGINAL,
                "Nc7+ is a fork that wins the rook, and mate follows.",
            ),
        ).toEqual(["fork", "mate", "wins"]);
    });

    it("lets a claim through when the explanation makes it", () => {
        expect(
            inventedClaims(
                "Qg4 is a blunder. Black answers Bxg4: Black wins material (+9).",
                "Qg4 is a blunder: Bxg4 wins the queen.",
            ),
        ).toEqual([]);
    });

    it("adds up moves and claims", () => {
        expect(
            rewordingProblems(ORIGINAL, "Nc7+ and then Nxa8 wins the rook."),
        ).toEqual(["Nxa8", "wins"]);
    });
});

const ORIGINAL =
    "Nd5 is the engine's choice. It attacks the queen on e7 with a cheaper piece. It threatens Nxe7+, winning a rook.";

describe("inventedChess", () => {
    it("accepts a rewording that keeps to the moves and squares given", () => {
        expect(
            inventedChess(
                ORIGINAL,
                "Nd5 is the move here: the knight hits the queen on e7, and Nxe7+ next would win a rook.",
            ),
        ).toEqual([]);
    });

    it("accepts a square named inside one of the moves", () => {
        expect(inventedChess(ORIGINAL, "The knight lands on d5.")).toEqual([]);
    });

    it("flags moves and squares the original does not have", () => {
        expect(
            inventedChess(
                ORIGINAL,
                "Nd5 is strong, and after Qd7 White plays Bxf7+ with a win on f7.",
            ),
        ).toEqual(["Qd7", "Bxf7", "f7"]);
        expect(inventedChess("e4 takes the centre.", "e4, then d4.")).toEqual([
            "d4",
        ]);
    });

    it("knows castling and promotions", () => {
        expect(
            inventedChess("O-O castles.", "O-O tucks the king away."),
        ).toEqual([]);
        expect(inventedChess("e8=Q+ wins.", "e8=Q is decisive.")).toEqual([]);
        expect(inventedChess("e8=Q+ wins.", "O-O-O first.")).toEqual(["O-O-O"]);
    });
});
