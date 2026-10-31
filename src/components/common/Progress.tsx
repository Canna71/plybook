// A progress bar whose value may not be known yet. A <progress>'s `value` property throws when
// set to undefined or NaN, and Solid sets it as a property, so a bar shown before the first
// numbers threw and stopped whatever showed it (F.20: the puzzle download never started).
// Without a value the bar shows that something is going on.

import { Show } from "solid-js";

type ProgressProps = {
    value: number | undefined;
    max?: number;
    class?: string;
};

const Progress = (props: ProgressProps) => {
    // `max` throws the same way
    const max = () =>
        props.max && Number.isFinite(props.max) ? props.max : 100;
    return (
        <Show
            when={Number.isFinite(props.value)}
            fallback={<progress class={props.class} max={max()} />}
        >
            <progress class={props.class} value={props.value} max={max()} />
        </Show>
    );
};

export default Progress;
