import { describe, expect, it } from "vitest";
import { Chess } from "chessops";
import { parseFen } from "chessops/fen";
import {
    describeOutcome,
    judgeMove,
    lineOutcome,
    materialBalance,
    scoreToEvaluation,
} from "./whatif";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
// 1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4?: Black offers the e5 pawn and allows Nxe5
const BEFORE_ND4 =
    "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3";
const AFTER_ND4 =
    "r1bqkbnr/pppp1ppp/8/4p3/2BnP3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";

describe("materialBalance", () => {
    it("is zero at the start and counts piece values", () => {
        const pos = (fen: string) =>
            Chess.fromSetup(parseFen(fen).unwrap()).unwrap();
        expect(materialBalance(pos(START), "white")).toBe(0);
        // White is a knight up
        const fen = "rnbqkb1r/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
        expect(materialBalance(pos(fen), "white")).toBe(3);
        expect(materialBalance(pos(fen), "black")).toBe(-3);
    });
});

describe("judgeMove", () => {
    it("labels a move by the winning chances it loses", () => {
        const verdict = judgeMove(
            BEFORE_ND4,
            scoreToEvaluation({ type: "cp", value: -20 }, "g8f6"),
            AFTER_ND4,
            scoreToEvaluation({ type: "cp", value: 100 }),
            "Nd4",
        )!;
        expect(verdict.color).toBe("black");
        expect(verdict.bestSan).toBe("Nf6");
        expect(verdict.class).toBe("mistake");
        expect(verdict.loss).toBeGreaterThan(10);
    });

    it("recognises the engine's own move", () => {
        const afterNf6 =
            "r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4";
        expect(
            judgeMove(
                BEFORE_ND4,
                scoreToEvaluation({ type: "cp", value: -20 }, "g8f6"),
                afterNf6,
                scoreToEvaluation({ type: "cp", value: -10 }),
                "Nf6",
            )?.class,
        ).toBe("best");
    });
});

describe("lineOutcome", () => {
    it("lets an exchange finish before counting", () => {
        // after 4. Nxd4 the recapture exd4 is part of the exchange
        const exchange = lineOutcome(
            AFTER_ND4,
            ["f3d4", "e5d4", "e1g1"],
            "white",
            1,
        )!;
        expect(exchange.sans).toEqual(["Nxd4", "exd4"]);
        expect(describeOutcome(exchange)).toBe("Material stays level");
        // after 4. Nxe5 Black does not recapture: White is a pawn up
        const pawn = lineOutcome(AFTER_ND4, ["f3e5", "d8g5"], "white", 1)!;
        expect(pawn.sans).toEqual(["Nxe5"]);
        expect(describeOutcome(pawn)).toBe("White wins material (+1)");
        // counted for Black, the same line reads the same
        expect(
            describeOutcome(
                lineOutcome(AFTER_ND4, ["f3e5", "d8g5"], "black", 1)!,
            ),
        ).toBe("White wins material (+1)");
    });

    it("reports mate and stops at illegal moves", () => {
        const scholar =
            "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 2 3";
        const outcome = lineOutcome(scholar, ["h5f7", "e8e7"], "white")!;
        expect(outcome.sans).toEqual(["Qxf7#"]);
        expect(outcome.mated).toBe("black");
        expect(describeOutcome(outcome)).toBe("White mates");
    });

    it("says when material stays level", () => {
        const outcome = lineOutcome(START, ["e2e4", "e7e5"], "white")!;
        expect(describeOutcome(outcome)).toBe("Material stays level");
    });
});
