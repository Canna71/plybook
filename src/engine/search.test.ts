import { describe, expect, it, vi } from "vitest";
import { IUCIInterface } from "./iuciinterface";
import { UCIEngine } from "./uciengine";
import { searchOnce } from "./search";
import { moveThreats } from "./threatsearch";

function fakeEngine() {
    const sent: string[] = [];
    let respond: (line: string) => void = () => {};
    const uci: IUCIInterface = {
        sendCommand: (command) => sent.push(command),
        onResponse: (callback) => (respond = callback),
        init: async () => {},
        close: () => {},
    };
    return {
        engine: new UCIEngine(uci),
        sent,
        output: (line: string) => respond(line),
    };
}

describe("searchOnce", () => {
    it("collects the last info of each line and the best move, from White's view", async () => {
        vi.useFakeTimers();
        const { engine, sent, output } = fakeEngine();
        const fen =
            "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3";
        const result = searchOnce(engine, fen, {
            depth: 12,
            multipv: 2,
            searchmoves: ["g8f6", "c6d4"],
        });
        vi.runAllTimers();
        expect(sent.at(-1)).toBe("go depth 12 searchmoves g8f6 c6d4");

        output("info depth 1 multipv 1 score cp 10 pv g8f6");
        output("info depth 12 multipv 1 score cp 20 pv g8f6 d2d3");
        output("info depth 12 multipv 2 score cp -90 pv c6d4 f3e5");
        output("bestmove g8f6 ponder d2d3");
        const { lines, bestmove } = await result;
        expect(bestmove).toBe("g8f6");
        // Black to move: scores flip to White's point of view
        expect(lines.map((l) => [l.pv![0], l.score])).toEqual([
            ["g8f6", { type: "cp", value: -20 }],
            ["c6d4", { type: "cp", value: 90 }],
        ]);
        vi.useRealTimers();
    });

    it("stops listening once done", async () => {
        const { engine, output } = fakeEngine();
        const result = searchOnce(engine, "8/8/8/8/8/8/8/K6k w - - 0 1", {});
        output("bestmove (none)");
        expect((await result).bestmove).toBeUndefined();
        // a later info does not throw or reach the finished search
        output("info depth 3 multipv 1 score cp 0 pv a1a2");
    });
});

describe("moveThreats", () => {
    /** An engine that answers each position with a scripted line. */
    function scriptedEngine(lines: Record<string, string>) {
        let respond: (line: string) => void = () => {};
        let fen = "";
        const uci: IUCIInterface = {
            sendCommand: (command) => {
                if (command.startsWith("position fen "))
                    fen = command.slice(13);
                if (command.startsWith("go")) {
                    const pv = Object.entries(lines).find(([f]) =>
                        fen.startsWith(f),
                    )?.[1];
                    setTimeout(() => {
                        if (pv)
                            respond(
                                `info depth 12 multipv 1 score cp 0 pv ${pv}`,
                            );
                        respond(`bestmove ${pv?.split(" ")[0] ?? "(none)"}`);
                    });
                }
            },
            onResponse: (callback) => (respond = callback),
            init: async () => {},
            close: () => {},
        };
        return new UCIEngine(uci);
    }

    it("searches both null-move positions and names the threat the move creates", async () => {
        // 1.e4 e5 2.Qh5 Nc6, White plays 3.Bc4: if Black passed, Qxf7#
        const before =
            "r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3";
        const engine = scriptedEngine({
            // Black to move after White passes (before Bc4): nothing much
            "r1bqkbnr/pppp1ppp/2n5/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b": "g8f6",
            // White to move after Black passes (after Bc4): mate
            "r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w": "h5f7",
        });
        const threats = await moveThreats(engine, before, "f1c4");
        expect(threats.created?.san).toBe("Qxf7#");
        expect(threats.stopped).toBeUndefined();
    });

    it("returns nothing for an illegal move", async () => {
        const engine = scriptedEngine({});
        expect(
            await moveThreats(engine, "8/8/8/8/8/8/8/K6k w - - 0 1", "e2e4"),
        ).toEqual({});
    });
});
