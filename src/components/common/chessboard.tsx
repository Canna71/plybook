import { Chessground } from "chessground";
import { Config } from "chessground/config";
import {
    Accessor,
    createEffect,
    createSignal,
    onMount,
    Setter,
} from "solid-js";
import { Api } from "chessground/api";
import { start as startDrawing } from "chessground/draw";
import { PenColour, shiftColour } from "../../models/drawing";

interface ChessboardProps {
    config: Accessor<Config>;
    setApi?: Setter<Api | undefined>;
    onChessboardClick?: (e: MouseEvent) => void;
    /** Pen mode (U.2): a plain press draws in this colour instead of moving pieces */
    pen?: Accessor<PenColour | undefined>;
}

export function Chessboard(props: ChessboardProps) {
    const [api, setApi] = createSignal<Api | undefined>(undefined);
    let wrapper!: HTMLDivElement;

    const onChessboardClick = (e: MouseEvent) => {
        props.onChessboardClick?.(e);
    };

    createEffect(() => {
        const ch = api();
        if (ch) {
            ch.set(props.config());
        }
    });

    // solid-js onLoad equivalent
    onMount(async () => {
        if (!wrapper) {
            return;
        }
        const api = Chessground(wrapper, props.config());
        // the dev driver plays moves with synthetic clicks (src/dev/devdriver.ts)
        if (import.meta.env.DEV) api.state.trustAllEvents = true;
        setApi(api);
        props.setApi?.(api);
        // chessground caches where the board is and forgets it only on resize or scroll: a
        // board moved by the layout around it (a panel above it changing) would take presses
        // on the wrong squares. Forget it at every press, before chessground handles it.
        const forgetBounds = () => api.state.dom.bounds.clear();
        for (const type of ["mousedown", "touchstart"])
            wrapper.addEventListener(type, forgetBounds, {
                capture: true,
                passive: true,
            });
        // drawing without the right button (U.2): in pen mode a plain press, else Shift + press
        // with its colour from the keys. Chessground draws on its own only with the right
        // button (in green or blue with Shift); its document handlers finish what starts here
        const drawWithoutRightButton = (e: MouseEvent | TouchEvent) => {
            const s = api.state;
            if (!s.drawable.enabled || s.viewOnly) return;
            if (e instanceof MouseEvent && e.button !== 0) return;
            if ("touches" in e && e.touches.length > 1) return;
            const colour = props.pen?.() ?? shiftColour(e);
            if (!colour) return;
            // before chessground's own listener on the board, inside this wrapper
            e.stopPropagation();
            startDrawing(s, e);
            if (s.drawable.current) s.drawable.current.brush = colour;
        };
        for (const type of ["mousedown", "touchstart"] as const)
            wrapper.addEventListener(type, drawWithoutRightButton, {
                capture: true,
                passive: false,
            });
    });

    return (
        <div class="chess-container">
            <div
                ref={wrapper}
                class="chessboard"
                classList={{ "pen-mode": !!props.pen?.() }}
                onclick={onChessboardClick}
            ></div>
        </div>
    );
}
