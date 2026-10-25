import { describe, expect, it, vi } from "vitest";
import { IUCIInterface } from "./iuciinterface";
import { UCIEngine } from "./uciengine";

/** A UCI process that records commands and lets the test send engine output. */
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

describe("UCIEngine", () => {
    it("parses search infos", () => {
        const { engine, output } = fakeEngine();
        const onInfo = vi.fn();
        engine.on("info", onInfo);
        output(
            "info depth 20 seldepth 28 multipv 2 score cp -35 nodes 1200 nps 500000 time 3 pv e7e5 g1f3 b8c6",
        );
        expect(onInfo).toHaveBeenCalledWith(
            expect.objectContaining({
                depth: 20,
                multipv: 2,
                score: { type: "cp", value: -35 },
                pv: ["e7e5", "g1f3", "b8c6"],
            }),
        );
    });

    it("reports mates and best moves", () => {
        const { engine, output } = fakeEngine();
        const onInfo = vi.fn();
        const onBest = vi.fn();
        engine.on("info", onInfo);
        engine.on("bestmove", onBest);
        output("info depth 5 multipv 1 score mate -2 pv h5f7");
        output("bestmove h5f7 ponder e8e7");
        expect(onInfo.mock.calls[0][0].score).toEqual({
            type: "mate",
            value: -2,
        });
        expect(onBest).toHaveBeenCalledWith("h5f7", "e8e7");
    });

    it("passes info strings on separately", () => {
        const { engine, output } = fakeEngine();
        const onInfo = vi.fn();
        const onString = vi.fn();
        engine.on("info", onInfo);
        engine.on("string", onString);
        output("info string g8f6  (159 ) N: 0 (+ 0) (P: 33.01%)");
        expect(onString).toHaveBeenCalledWith(
            "g8f6  (159 ) N: 0 (+ 0) (P: 33.01%)",
        );
        expect(onInfo).not.toHaveBeenCalled();
    });

    it("searches a position with nodes, or depth and time", async () => {
        vi.useFakeTimers();
        const { engine, sent } = fakeEngine();
        const fen = "8/8/8/8/8/8/8/K6k w - - 0 1";
        engine.analyzeFromFenOrMoves(fen, {
            nodes: 1,
            depth: 10,
            movetime: 500,
        });
        vi.runAllTimers();
        expect(sent).toContain(`position fen ${fen}`);
        expect(sent.at(-1)).toBe("go nodes 1");

        engine.analyzeFromFenOrMoves(fen, {
            depth: 18,
            movetime: 1000,
            multipv: 3,
        });
        vi.runAllTimers();
        expect(sent).toContain("setoption name MultiPV value 3");
        expect(sent.at(-1)).toBe("go depth 18 movetime 1000");

        // with clocks the engine manages its time: no depth or movetime
        engine.analyzeFromFenOrMoves(fen, {
            depth: 18,
            movetime: 1000,
            clock: { wtime: 300000, btime: 295000, winc: 3000, binc: 3000 },
        });
        vi.runAllTimers();
        expect(sent.at(-1)).toBe(
            "go wtime 300000 btime 295000 winc 3000 binc 3000",
        );
        vi.useRealTimers();
    });

    it("is ready after uciok and readyok", async () => {
        const { engine, sent, output } = fakeEngine();
        const ready = engine.init();
        await Promise.resolve(); // the process starts first
        expect(sent).toEqual(["uci"]);
        output("id name Stockfish 17");
        output("uciok");
        expect(sent).toEqual(["uci", "isready"]);
        output("readyok");
        await ready;
        expect(engine.getId()?.name).toBe("Stockfish 17");
    });
});
