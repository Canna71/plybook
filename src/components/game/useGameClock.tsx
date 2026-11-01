// The clocks of a game against the engine (O.4): started and stopped with the game, pressed
// after each move, ticking on screen, and calling the flag. The rules are in models/clock.ts.

import {
    Accessor,
    createEffect,
    createSignal,
    on,
    onCleanup,
    Show,
    untrack,
} from "solid-js";
import { Color } from "chessops";
import {
    ClockState,
    engineTimes,
    flagged,
    formatClock,
    parseTimeControl,
    pressClock,
    remaining,
    startClock,
    stopClock,
    TimeControl,
} from "../../models/clock";
import { getSettingValue } from "../../models/settings";

export const TIME_CONTROL_SETTING = "engine.playing.timeControl";

/** Ticks this often while a clock runs */
const TICK = 100;

export function useGameClock(o: {
    /** A game against the engine is being played */
    playing: Accessor<boolean>;
    turn: Accessor<Color>;
    /** A game starts with this time control (none: no clocks) */
    onStart: (tc: TimeControl) => void;
    onFlag: (color: Color) => void;
}) {
    const [clock, setClock] = createSignal<ClockState>();
    const [now, setNow] = createSignal(Date.now());

    createEffect(
        on(o.playing, (playing) => {
            const t = Date.now();
            setNow(t);
            if (playing) {
                // a game with the tutor has no clock: take-backs and questions pause it
                const tutor = getSettingValue("tutor.on", false);
                const tc = parseTimeControl(
                    tutor ? "" : getSettingValue(TIME_CONTROL_SETTING, ""),
                );
                setClock(tc && startClock(tc, untrack(o.turn), t));
                if (tc) o.onStart(tc);
            } else {
                setClock((c) => c && stopClock(c, t));
            }
        }),
    );

    const timer = setInterval(() => {
        const c = clock();
        if (!c?.running) return;
        const t = Date.now();
        setNow(t);
        const out = flagged(c, t);
        if (out) {
            setClock(stopClock(c, t));
            o.onFlag(out);
        }
    }, TICK);
    onCleanup(() => clearInterval(timer));

    return {
        clock,
        /** After a move: stops the mover's clock; its time left in seconds, for [%clk] */
        press: (): number | undefined => {
            const c = clock();
            if (!c?.running) return undefined;
            const mover = c.running;
            const next = pressClock(c, Date.now());
            setClock(next);
            return next[mover] / 1000;
        },
        /** For the engine's search: both clocks now */
        times: () => {
            const c = clock();
            return c?.running ? engineTimes(c, Date.now()) : undefined;
        },
        left: (color: Color) => {
            const c = clock();
            return c && remaining(c, color, now());
        },
    };
}

export type GameClock = ReturnType<typeof useGameClock>;

/** One side's clock: highlighted while it runs, red in the last ten seconds. */
export const ClockFace = (props: { clock: GameClock; color: Color }) => (
    <Show when={props.clock.clock()}>
        <div
            class="game-clock"
            classList={{
                running: props.clock.clock()!.running === props.color,
                low: (props.clock.left(props.color) ?? 0) < 10_000,
            }}
        >
            {formatClock(props.clock.left(props.color) ?? 0)}
        </div>
    </Show>
);
