import { describe, expect, it } from "vitest";
import { Chess } from "chessops";
import { makeFen } from "chessops/fen";
import { parseSan } from "chessops/san";
import { EngineInfo } from "../engine/engineinterfaces";
import { onlyMove } from "./onlymove";

/** The FEN after `sans` from the start */
function after(sans: string): string {
    const pos = Chess.default();
    for (const san of sans.split(" ").filter(Boolean))
        pos.play(parseSan(pos, san)!);
    return makeFen(pos.toSetup());
}

/** A line as searchOnce gives it: score from White's side */
const line = (uci: string, cp: number, depth = 16): EngineInfo => ({
    pv: [uci],
    score: { type: "cp", value: cp },
    depth,
});

describe("onlyMove", () => {
    const START = after("");

    it("the best move is the only one when the next gives away 10% or more", () => {
        const only = onlyMove(START, [line("e2e4", 30), line("d2d4", -200)])!;
        expect(only.best.san).toBe("e4");
        expect(only.second.san).toBe("d4");
        expect(only.gap).toBeGreaterThan(20);
        expect(only.keeps).toBe("balance");
        expect(only.depth).toBe(16);
    });

    it("not when the second move is nearly as good", () => {
        expect(
            onlyMove(START, [line("e2e4", 30), line("d2d4", 20)]),
        ).toBeUndefined();
    });

    it("reads the scores for Black when Black moves", () => {
        const only = onlyMove(after("e4"), [
            line("e7e5", -300),
            line("d7d5", 100),
        ])!;
        expect(only.best.san).toBe("e5");
        expect(only.keeps).toBe("advantage");
    });

    it("says what is kept: a mate, or only limiting the damage", () => {
        const mate: EngineInfo = {
            pv: ["e2e4"],
            score: { type: "mate", value: 3 },
            depth: 20,
        };
        expect(onlyMove(START, [mate, line("d2d4", 0)])?.keeps).toBe("mate");
        expect(
            onlyMove(START, [line("e2e4", -300), line("d2d4", -700)])?.keeps,
        ).toBe("damage");
    });

    it("not for taking back what was just taken (1.e4 d5 2.exd5 Qxd5)", () => {
        expect(
            onlyMove(
                after("e4 d5 exd5"),
                [line("d8d5", 0), line("g8f6", 300)],
                after("e4 d5"),
            ),
        ).toBeUndefined();
    });

    it("not for taking a piece nothing defends, but for a defended one", () => {
        const free = "4k3/8/8/3n4/8/8/8/3RK3 w - - 0 1";
        expect(
            onlyMove(free, [line("d1d5", 500), line("e1e2", 0)]),
        ).toBeUndefined();
        const defended = "4k3/8/4p3/3n4/8/8/8/3RK3 w - - 0 1";
        expect(
            onlyMove(defended, [line("d1d5", 200), line("e1e2", -200)])?.best
                .san,
        ).toBe("Rxd5");
    });

    it("needs two legal lines", () => {
        expect(onlyMove(START, [line("e2e4", 30)])).toBeUndefined();
        expect(
            onlyMove(START, [line("e2e4", 30), line("e7e5", -300)]),
        ).toBeUndefined();
    });
});
