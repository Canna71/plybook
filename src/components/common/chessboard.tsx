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

interface ChessboardProps {
    config: Accessor<Config>;
    setApi?: Setter<Api | undefined>;
    onChessboardClick?: (e: MouseEvent) => void;
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
    });

    return (
        <div class="chess-container">
            <div
                ref={wrapper}
                class="chessboard"
                onclick={onChessboardClick}
            ></div>
        </div>
    );
}
