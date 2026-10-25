// gifenc 1.0.3 ships no types (used by src/export/boardexport.ts). A file of its own: an
// import at the top would make it a module, and the declaration would not apply.
declare module "gifenc" {
    type Palette = number[][];
    export function GIFEncoder(): {
        writeFrame(
            index: Uint8Array,
            width: number,
            height: number,
            options?: { palette?: Palette; delay?: number; repeat?: number },
        ): void;
        finish(): void;
        bytes(): Uint8Array;
    };
    export function quantize(
        rgba: Uint8Array | Uint8ClampedArray,
        maxColors: number,
    ): Palette;
    export function applyPalette(
        rgba: Uint8Array | Uint8ClampedArray,
        palette: Palette,
    ): Uint8Array;
}
