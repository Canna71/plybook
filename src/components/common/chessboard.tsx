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
import { coordinatesConfig } from "../../models/boardtheme";
import { getSettingValue } from "../../models/settings";

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

    // the coordinates style of the settings (U.3), unless a board turns them off itself
    const style = () => getSettingValue("themes.coordinates", "edges");
    const withCoordinates = (config: Config): Config =>
        config.coordinates === false
            ? config
            : { ...config, ...coordinatesConfig(style()) };
    let drawnStyle: string | undefined;

    createEffect(() => {
        const ch = api();
        if (ch) {
            ch.set(withCoordinates(props.config()));
            // chessground draws the coordinates when it builds the board: a new style redraws it
            if (drawnStyle !== undefined && drawnStyle !== style())
                ch.redrawAll();
            drawnStyle = style();
        }
    });

    // solid-js onLoad equivalent
    onMount(async () => {
        if (!wrapper) {
            return;
        }
        const api = Chessground(wrapper, withCoordinates(props.config()));
        // the dev driver plays moves with synthetic clicks (src/dev/devdriver.ts)
        if (import.meta.env.DEV) api.state.trustAllEvents = true;
        setApi(api);
        props.setApi?.(api);
        // chessground caches where the board is and forgets it only on resize or scroll: a
        // board moved by the layout around it (a panel above it changing) would take presses
        // on the wrong squares. Forget it at every press, before chessground handles it.
        // A press also ends typing elsewhere (a player's name, F.6): chessground prevents the
        // press's default, which is what would take the focus away from the field.
        const forgetBounds = () => {
            api.state.dom.bounds.clear();
            const typing = document.activeElement as HTMLElement | null;
            if (
                typing?.isContentEditable ||
                typing instanceof HTMLInputElement ||
                typing instanceof HTMLTextAreaElement
            )
                typing.blur();
        };
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
