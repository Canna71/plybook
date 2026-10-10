import { ReferenceElement } from "@floating-ui/dom";
import { createSignal } from "solid-js";
import { PlyData } from "../../models/pgn";

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
