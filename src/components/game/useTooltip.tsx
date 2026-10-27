import { ReferenceElement } from "@floating-ui/dom";
import { createSignal, useContext } from "solid-js";
import { DOMElement } from "solid-js/jsx-runtime";
import { PlyData } from "../../models/pgn";
import { TooltipContext } from "./GameContext";

export function useTooltip() {
    const [reference, setReference] = createSignal<
        ReferenceElement | null | undefined
    >(undefined);
    const [ply, setPly] = createSignal<PlyData>();

    const showTooltip = (
        anchor: Element | undefined,
        plyData: PlyData | undefined,
    ) => {
        setPly(plyData);
        setReference(anchor);
    };

    return { reference, ply, showTooltip };
}

/** A mouse handler that shows the position of `plyData` at the element (none: hides it) */
export function useFenTooltip(
    tooltipEnabled: boolean,
    plyData: PlyData | undefined,
) {
    const { showTooltip } = useContext(TooltipContext)!;
    return (
        e:
            | (MouseEvent & {
                  currentTarget: HTMLElement;
                  target: DOMElement;
              })
            | undefined,
    ) => {
        if (!tooltipEnabled) return;
        if (e) {
            if (plyData) showTooltip(e.currentTarget, plyData);
        } else {
            showTooltip(undefined, undefined);
        }
    };
}
