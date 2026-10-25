// Chess clocks for games against the engine (O.4): time controls, the running clock, flag
// falls, and the times the engine is told. Times are milliseconds; `now` is passed in so
// the logic can be tested without waiting.

import { Color } from "chessops";

export type TimeControl = {
    /** Starting time per side */
    initial: number;
    /** Added after each move (Fischer increment) */
    increment: number;
};

/** "5+3": five minutes and three seconds a move. "" or anything else: no clock. */
export function parseTimeControl(text: string): TimeControl | undefined {
    const m = /^\s*(\d+(?:\.\d+)?)\s*\+\s*(\d+)\s*$/.exec(text);
    if (!m) return undefined;
    const initial = Math.round(parseFloat(m[1]) * 60_000);
    return initial > 0 ? { initial, increment: +m[2] * 1000 } : undefined;
}

/** The PGN TimeControl tag: seconds and increment ("300+3"). */
export const pgnTimeControl = (tc: TimeControl) =>
    `${Math.round(tc.initial / 1000)}+${Math.round(tc.increment / 1000)}`;

/** Time controls offered when playing, as "minutes+seconds"; "" is none. */
export const TIME_CONTROLS = [
    "",
    "1+0",
    "3+2",
    "5+3",
    "10+5",
    "15+10",
    "30+20",
];

export type ClockState = {
    tc: TimeControl;
    /** Time left when the side last stopped its clock */
    white: number;
    black: number;
    /** The side whose clock runs, if any, and since when */
    running?: Color;
    since: number;
};

export const startClock = (
    tc: TimeControl,
    turn: Color,
    now: number,
): ClockState => ({
    tc,
    white: tc.initial,
    black: tc.initial,
    running: turn,
    since: now,
});

/** Time left for `color` at `now`, never below zero. */
export function remaining(c: ClockState, color: Color, now: number): number {
    const left = c.running === color ? c[color] - (now - c.since) : c[color];
    return Math.max(0, left);
}

/**
 * The running side has moved: its clock stops (with the increment added) and the other
 * side's starts.
 */
export function pressClock(c: ClockState, now: number): ClockState {
    if (!c.running) return c;
    const mover = c.running;
    const other: Color = mover === "white" ? "black" : "white";
    return {
        ...c,
        [mover]: remaining(c, mover, now) + c.tc.increment,
        running: other,
        since: now,
    };
}

export const stopClock = (c: ClockState, now: number): ClockState =>
    c.running
        ? {
              ...c,
              [c.running]: remaining(c, c.running, now),
              running: undefined,
          }
        : c;

/** The side whose time has run out, if any. */
export function flagged(c: ClockState, now: number): Color | undefined {
    return c.running && remaining(c, c.running, now) <= 0
        ? c.running
        : undefined;
}

/** The UCI "go" times for the engine to manage its own clock. */
export const engineTimes = (c: ClockState, now: number) => ({
    wtime: Math.round(remaining(c, "white", now)),
    btime: Math.round(remaining(c, "black", now)),
    winc: c.tc.increment,
    binc: c.tc.increment,
});

/** "4:59", "1:02:03", and tenths under ten seconds ("9.4"). */
export function formatClock(ms: number): string {
    if (ms < 10_000) return (Math.floor(ms / 100) / 10).toFixed(1);
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
