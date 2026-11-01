import { describe, expect, it } from "vitest";
import { EngineState, engineTask, searchPlan, Setting } from "./enginetask";

const FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1";

const state = (s: Partial<EngineState>): EngineState => ({
    hasEngine: true,
    analysisOn: false,
    reviewing: false,
    refuting: false,
    threat: false,
    playing: false,
    tutor: false,
    atEnd: true,
    turn: "black",
    fen: FEN,
    ...s,
});

// the defaults, as when nothing is set
const defaults: Setting = (_key, fallback) => fallback;

describe("engineTask", () => {
    it("is idle without an engine or anything to do", () => {
        expect(
            engineTask(state({ hasEngine: false, analysisOn: true })),
        ).toEqual({ kind: "idle" });
        expect(engineTask(state({}))).toEqual({ kind: "idle" });
    });

    it("analyses, or shows threats, while analysis is on", () => {
        expect(engineTask(state({ analysisOn: true })).kind).toBe("analysis");
        expect(engineTask(state({ analysisOn: true, threat: true })).kind).toBe(
            "threat",
        );
    });

    it("puts a review before a refutation, and both before the rest", () => {
        expect(
            engineTask(
                state({ analysisOn: true, reviewing: true, refuting: true }),
            ).kind,
        ).toBe("review");
        expect(engineTask(state({ refuting: true, threat: true })).kind).toBe(
            "refutation",
        );
    });

    it("plays its own moves and hints on the player's turn", () => {
        const playing = { playing: true, engineColor: "black" as const };
        expect(engineTask(state(playing))).toEqual({
            kind: "play",
            fen: FEN,
            enginesTurn: true,
        });
        expect(engineTask(state({ ...playing, turn: "white" }))).toMatchObject({
            kind: "play",
            enginesTurn: false,
        });
    });

    it("stays out of the game for the tutor, before a colour, and in an earlier position", () => {
        const playing = { playing: true, engineColor: "black" as const };
        expect(engineTask(state({ ...playing, tutor: true })).kind).toBe(
            "idle",
        );
        expect(engineTask(state({ playing: true })).kind).toBe("idle");
        expect(engineTask(state({ ...playing, atEnd: false })).kind).toBe(
            "idle",
        );
    });
});

describe("searchPlan", () => {
    it("has no search when idle", () => {
        expect(searchPlan({ kind: "idle" }, {}, defaults)).toBeUndefined();
    });

    it("reviews one line at the review settings", () => {
        const plan = searchPlan({ kind: "review", fen: FEN }, {}, defaults);
        expect(plan?.options).toMatchObject({
            depth: 18,
            movetime: 1000,
            multipv: 1,
        });
        expect(plan?.strength).toBeUndefined();
    });

    it("weakens only the engine's own moves", () => {
        const weak = { limitStrength: true };
        const own = searchPlan(
            { kind: "play", fen: FEN, enginesTurn: true },
            weak,
            defaults,
        );
        const hint = searchPlan(
            { kind: "play", fen: FEN, enginesTurn: false },
            weak,
            defaults,
        );
        const analysis = searchPlan(
            { kind: "analysis", fen: FEN },
            weak,
            defaults,
        );
        expect(own?.strength).toEqual({ limit: true, elo: 1000 });
        expect(hint?.strength).toEqual({ limit: false, elo: 3200 });
        expect(analysis?.strength).toEqual({ limit: false, elo: 3200 });
    });

    it("plays a single-node net's first choice, but searches its hints", () => {
        const net = { singleNode: true };
        expect(
            searchPlan(
                { kind: "play", fen: FEN, enginesTurn: true },
                net,
                defaults,
            )?.options.nodes,
        ).toBe(1);
        expect(
            searchPlan(
                { kind: "play", fen: FEN, enginesTurn: false },
                net,
                defaults,
            )?.options.nodes,
        ).toBeUndefined();
    });

    it("reads the settings", () => {
        const setting: Setting = (path, fallback) =>
            path === "engine.analysis.multipv"
                ? (5 as typeof fallback)
                : fallback;
        expect(
            searchPlan({ kind: "analysis", fen: FEN }, {}, setting)?.options
                .multipv,
        ).toBe(5);
    });
});
