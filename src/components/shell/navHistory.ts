// Back and forward between the places visited (F.25), on the webview's own history, so every
// way of getting somewhere counts (links, ⌘K, buttons). The router numbers each history entry
// (`_depth` in history.state), so whether there is somewhere to go back or forward to is read
// from it rather than kept on the side.

import { createEffect, createSignal, onCleanup, onMount } from "solid-js";
import { useLocation } from "@solidjs/router";
import { isMacOS } from "../../models/osutils";

const depthNow = (): number => window.history.state?._depth ?? 0;

/** Back and forward, with ⌘[ / ⌘] (Alt+← / Alt+→ on Windows); used once, by the sidebar */
export function useNavHistory() {
    const location = useLocation();
    // the app's first entry: nothing before it is the app's
    const start = depthNow();
    const [canBack, setCanBack] = createSignal(false);
    const [canForward, setCanForward] = createSignal(false);
    const update = () => {
        const depth = depthNow();
        setCanBack(depth > start);
        setCanForward(depth < window.history.length - 1);
    };
    createEffect(() => {
        void location.pathname;
        void location.search;
        // after the router has written the new entry's depth
        queueMicrotask(update);
    });

    const back = () => canBack() && window.history.back();
    const forward = () => canForward() && window.history.forward();

    const mac = isMacOS();
    const onKey = (e: KeyboardEvent) => {
        if (e.defaultPrevented) return;
        let go: (() => void) | undefined;
        if (mac && e.metaKey && !e.altKey && !e.ctrlKey) {
            if (e.key === "[") go = back;
            else if (e.key === "]") go = forward;
        } else if (!mac && e.altKey && !e.ctrlKey && !e.metaKey) {
            if (e.key === "ArrowLeft") go = back;
            else if (e.key === "ArrowRight") go = forward;
        }
        if (!go) return;
        e.preventDefault();
        go();
    };
    onMount(() => document.addEventListener("keydown", onKey));
    onCleanup(() => document.removeEventListener("keydown", onKey));

    const keys = mac
        ? { back: "⌘[", forward: "⌘]" }
        : { back: "Alt+←", forward: "Alt+→" };
    return { canBack, canForward, back, forward, keys };
}
