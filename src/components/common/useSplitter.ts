// A draggable divider between grid columns (split-grid); the layout is saved as it settles.

import Split from "split-grid";
import { debounce } from "es-toolkit";

/** A ref callback for the divider, which sits in the grid's second track */
export function useSplitter(saveLayout?: (layout: string) => void) {
    const doSave = debounce((value: string) => {
        saveLayout?.(value);
    }, 300);

    return (divider: HTMLDivElement) => {
        Split({
            columnGutters: [
                {
                    track: 1,
                    element: divider,
                },
            ],
            writeStyle: (grid, prop, value) => {
                (grid.style as any)[prop] = value;
                doSave(value);
            },
        });
    };
}
