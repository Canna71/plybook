// What the game manager's engine is doing (useChessEngine): one task at a time, decided from
// the screen's state, and the search each task runs. Pure, for tests: settings come in as a
// function.

import { Color } from "chessops";
import { AnalysisOptions } from "./engineinterfaces";
// types only: settings.ts itself touches window on import
import type { SettingPath, SettingValue } from "../models/settings";

export type EngineTask =
    | { kind: "idle" }
    /** A game review: the position under review, its eval and best move go into the game */
    | { kind: "review"; fen: string }
    /** A wrong puzzle move was played: the answer that refutes it */
    | { kind: "refutation"; fen: string }
    /** Threat mode: what the opponent would play if it were their move */
    | { kind: "threat"; fen: string }
    /** Plain analysis of the position shown */
    | { kind: "analysis"; fen: string }
    /** A game against the engine: its own move, or on the player's turn the hint */
    | { kind: "play"; fen: string; enginesTurn: boolean };

export type EngineState = {
    /** An engine is running */
    hasEngine: boolean;
    analysisOn: boolean;
    reviewing: boolean;
    /** A wrong puzzle move is on the board */
    refuting: boolean;
    /** Threat mode is searching (the fen is then the null-move position) */
    threat: boolean;
    /** A game against the engine is going on (Play screen, started, not over) */
    playing: boolean;
    engineColor?: Color;
    /** The tutor plays the engine's moves (useTutor): this engine stays out of the game */
    tutor: boolean;
    /** The position shown is the last of its line (no move to replay after it) */
    atEnd: boolean;
    turn: Color;
    /** The position to search: under review, after the wrong move, null-move, or shown */
    fen: string;
};

export function engineTask(s: EngineState): EngineTask {
    if (!s.hasEngine) return { kind: "idle" };
    if (s.analysisOn || s.reviewing || s.refuting) {
        if (s.reviewing) return { kind: "review", fen: s.fen };
        if (s.refuting) return { kind: "refutation", fen: s.fen };
        if (s.threat) return { kind: "threat", fen: s.fen };
        return { kind: "analysis", fen: s.fen };
    }
    // when playing, the engine also thinks on the player's turn: that bestmove is the hint
    if (s.playing && s.engineColor && !s.tutor && s.atEnd) {
        return {
            kind: "play",
            fen: s.fen,
            enginesTurn: s.engineColor === s.turn,
        };
    }
    return { kind: "idle" };
}

/** The same search: an equal task does not restart the engine */
export const sameTask = (a: EngineTask, b: EngineTask) =>
    a.kind === b.kind &&
    (a.kind === "idle" ||
        (a.fen === (b as typeof a).fen &&
            (a.kind !== "play" ||
                a.enginesTurn === (b as typeof a).enginesTurn)));

/** getSettingValue with a fallback */
export type Setting = <P extends SettingPath>(
    path: P,
    fallback: NonNullable<SettingValue<P>>,
) => NonNullable<SettingValue<P>>;

export type SearchPlan = {
    options: AnalysisOptions;
    /** UCI options to set first, for engines that can play weaker */
    strength?: { limit: boolean; elo: number };
};

/** Full strength, for everything but the engine's own moves in a game */
const FULL_STRENGTH = { limit: false, elo: 3200 };

/** The search a task runs; undefined for idle. `singleNode`: a Maia-like net, one node. */
export function searchPlan(
    task: EngineTask,
    profile: { limitStrength?: boolean; singleNode?: boolean } | undefined,
    setting: Setting,
): SearchPlan | undefined {
    const threads = setting("engine.threads", 1);
    const strength = (s: { limit: boolean; elo: number }) =>
        profile?.limitStrength ? s : undefined;
    switch (task.kind) {
        case "idle":
            return undefined;
        case "review":
            return {
                options: {
                    depth: setting("engine.review.depth", 18),
                    movetime: setting("engine.review.movetime", 1000),
                    multipv: 1,
                    threads,
                },
                strength: strength(FULL_STRENGTH),
            };
        case "refutation":
        case "threat":
        case "analysis":
            return {
                options: {
                    nodes: profile?.singleNode ? 1 : undefined,
                    depth: setting("engine.analysis.depth", 15),
                    movetime: setting("engine.analysis.movetime", 10000),
                    multipv: setting("engine.analysis.multipv", 3),
                    threads,
                },
                strength: strength(FULL_STRENGTH),
            };
        case "play":
            return {
                options: {
                    nodes:
                        profile?.singleNode && task.enginesTurn ? 1 : undefined,
                    depth: setting("engine.playing.depth", 15),
                    movetime: setting("engine.playing.movetime", 10000),
                    multipv: 1,
                    threads,
                },
                // limited strength for the engine's own moves, not for hints
                strength: strength(
                    task.enginesTurn
                        ? {
                              limit: true,
                              elo: setting("engine.playing.elo", 1000),
                          }
                        : FULL_STRENGTH,
                ),
            };
    }
}
