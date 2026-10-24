// Every diagram on a page: fenshot reads one board per pass, so each board found is covered
// up and the page is scanned again, until nothing more turns up.

import {
    BoardCorners,
    BoardScanResult,
    extractTiles,
    GrayImage,
    probsToPlacement,
    recognizeGray,
    TileClassifier,
} from "@scoriiu/fenshot";

/** At most this many diagrams per page (books rarely print more than six). */
export const MAX_DIAGRAMS_PER_PAGE = 12;

/** Runs the tile model on 64 tiles; injected so the browser and tests can differ. */
export type TileModel = (tiles: Float32Array) => Promise<Float32Array>;

export const classifierFor =
    (gray: GrayImage, model: TileModel): TileClassifier =>
    async (corners) =>
        probsToPlacement(await model(extractTiles(gray, corners)));

/** Margin around a found board that is covered too (its frame, coordinates). */
const MASK_MARGIN = 0.04;

/** The typical brightness just outside a box: the page around a diagram. */
function surrounding(
    gray: GrayImage,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
) {
    const values: number[] = [];
    const at = (x: number, y: number) => {
        if (x >= 0 && y >= 0 && x < gray.width && y < gray.height) {
            values.push(gray.data[y * gray.width + x]);
        }
    };
    for (let x = x0; x < x1; x += 4) {
        at(x, y0 - 2);
        at(x, y1 + 1);
    }
    for (let y = y0; y < y1; y += 4) {
        at(x0 - 2, y);
        at(x1 + 1, y);
    }
    if (!values.length) return 255;
    values.sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
}

/**
 * Covers a found board (and a little margin) with the colour of the page around it, so no new
 * edges appear and the detector moves on to the next board.
 */
export function maskRegion(gray: GrayImage, box: BoardCorners): GrayImage {
    const data = Float32Array.from(gray.data);
    const margin = (box.x1 - box.x0) * MASK_MARGIN;
    const x0 = Math.max(0, Math.floor(box.x0 - margin));
    const y0 = Math.max(0, Math.floor(box.y0 - margin));
    const x1 = Math.min(gray.width, Math.ceil(box.x1 + margin));
    const y1 = Math.min(gray.height, Math.ceil(box.y1 + margin));
    const fill = surrounding(gray, x0, y0, x1, y1);
    for (let y = y0; y < y1; y++) {
        data.fill(fill, y * gray.width + x0, y * gray.width + x1);
    }
    return { data, width: gray.width, height: gray.height };
}

/** Rows first: boxes whose tops are within half a board of each other share a row. */
function readingOrder<T extends { corners: BoardCorners }>(found: T[]): T[] {
    return [...found].sort((a, b) => {
        const height = a.corners.y1 - a.corners.y0;
        return Math.abs(a.corners.y0 - b.corners.y0) < height / 2
            ? a.corners.x0 - b.corners.x0
            : a.corners.y0 - b.corners.y0;
    });
}

/**
 * The diagrams on a page, in reading order (top to bottom, then left to right). Reads that are
 * not a position (no king for a side: a decorative or empty board) end the search.
 */
export async function findDiagrams(
    gray: GrayImage,
    model: TileModel,
    max = MAX_DIAGRAMS_PER_PAGE,
): Promise<BoardScanResult[]> {
    const found: BoardScanResult[] = [];
    let working = gray;
    while (found.length < max) {
        const result = await recognizeGray(
            working,
            classifierFor(working, model),
        );
        if (!result?.plausible) break;
        found.push(result);
        working = maskRegion(working, result.corners);
    }
    return readingOrder(found);
}

const CELL = 8;
/** A cell holds ink when its darkest pixel is darker than this */
const INK = 160;
/** Diagrams are about square: width / height within these bounds (a caption may be included) */
const MIN_RATIO = 0.7;
const MAX_RATIO = 1.4;
/** and at least this share of the page's shorter side */
const MIN_SIZE = 0.12;

/**
 * Square-ish blobs of ink that may hold a diagram, from a coarse grid of the page. The
 * detector reads lines across the whole image, so with several diagrams it can pair one
 * board's columns with another's rows; scanning each blob on its own avoids that.
 */
export function diagramRegions(gray: GrayImage): BoardCorners[] {
    const cols = Math.ceil(gray.width / CELL);
    const rows = Math.ceil(gray.height / CELL);
    const ink = new Uint8Array(cols * rows);
    for (let y = 0; y < gray.height; y++) {
        const row = Math.floor(y / CELL) * cols;
        for (let x = 0; x < gray.width; x++) {
            if (gray.data[y * gray.width + x] < INK)
                ink[row + Math.floor(x / CELL)] = 1;
        }
    }
    // components of ink cells, touching sideways or diagonally
    const label = new Int32Array(cols * rows).fill(-1);
    const boxes: BoardCorners[] = [];
    for (let start = 0; start < ink.length; start++) {
        if (!ink[start] || label[start] >= 0) continue;
        const box = { x0: cols, y0: rows, x1: 0, y1: 0 };
        const stack = [start];
        label[start] = boxes.length;
        while (stack.length) {
            const i = stack.pop()!;
            const cx = i % cols;
            const cy = Math.floor(i / cols);
            box.x0 = Math.min(box.x0, cx);
            box.y0 = Math.min(box.y0, cy);
            box.x1 = Math.max(box.x1, cx + 1);
            box.y1 = Math.max(box.y1, cy + 1);
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const nx = cx + dx;
                    const ny = cy + dy;
                    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
                    const j = ny * cols + nx;
                    if (ink[j] && label[j] < 0) {
                        label[j] = boxes.length;
                        stack.push(j);
                    }
                }
            }
        }
        boxes.push(box);
    }
    const minSize = Math.min(gray.width, gray.height) * MIN_SIZE;
    return boxes
        .map((b) => ({
            x0: b.x0 * CELL,
            y0: b.y0 * CELL,
            x1: Math.min(gray.width, b.x1 * CELL),
            y1: Math.min(gray.height, b.y1 * CELL),
        }))
        .filter((b) => {
            const w = b.x1 - b.x0;
            const h = b.y1 - b.y0;
            return (
                w >= minSize &&
                h >= minSize &&
                w / h >= MIN_RATIO &&
                w / h <= MAX_RATIO
            );
        });
}

/** A part of the image, with a small margin of page around it. */
export function crop(
    gray: GrayImage,
    box: BoardCorners,
): { image: GrayImage; x: number; y: number } {
    const margin = Math.round((box.x1 - box.x0) * 0.05);
    const x = Math.max(0, box.x0 - margin);
    const y = Math.max(0, box.y0 - margin);
    const width = Math.min(gray.width, box.x1 + margin) - x;
    const height = Math.min(gray.height, box.y1 + margin) - y;
    const data = new Float32Array(width * height);
    for (let row = 0; row < height; row++) {
        const from = (y + row) * gray.width + x;
        data.set(gray.data.subarray(from, from + width), row * width);
    }
    return { image: { data, width, height }, x, y };
}

/**
 * Resizes an image: averaging the pixels each new pixel covers when shrinking (so fine
 * hatching turns into an even grey, not moiré), bilinear when enlarging.
 */
export function resize(
    gray: GrayImage,
    width: number,
    height: number,
): GrayImage {
    const data = new Float32Array(width * height);
    const sx = gray.width / width;
    const sy = gray.height / height;
    const at = (x: number, y: number) =>
        gray.data[
            Math.min(gray.height - 1, Math.max(0, y)) * gray.width +
                Math.min(gray.width - 1, Math.max(0, x))
        ];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let value: number;
            if (sx >= 1 && sy >= 1) {
                const x0 = Math.floor(x * sx);
                const y0 = Math.floor(y * sy);
                const x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
                const y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
                let sum = 0;
                for (let yy = y0; yy < y1; yy++) {
                    for (let xx = x0; xx < x1; xx++) sum += at(xx, yy);
                }
                value = sum / ((x1 - x0) * (y1 - y0));
            } else {
                const fx = (x + 0.5) * sx - 0.5;
                const fy = (y + 0.5) * sy - 0.5;
                const ix = Math.floor(fx);
                const iy = Math.floor(fy);
                const tx = fx - ix;
                const ty = fy - iy;
                value =
                    at(ix, iy) * (1 - tx) * (1 - ty) +
                    at(ix + 1, iy) * tx * (1 - ty) +
                    at(ix, iy + 1) * (1 - tx) * ty +
                    at(ix + 1, iy + 1) * tx * ty;
            }
            data[y * width + x] = value;
        }
    }
    return { data, width, height };
}

/** Diagram width the detector reads best; each region is scaled to it before reading. */
export const DIAGRAM_WIDTH = 520;

/**
 * Every diagram on a book page: each square-ish blob of ink is scaled to DIAGRAM_WIDTH and
 * scanned on its own, so diagram size and print resolution matter little; a page without such
 * blobs (a screenshot, say) is scanned as a whole.
 */
export async function findDiagramsOnPage(
    gray: GrayImage,
    model: TileModel,
): Promise<BoardScanResult[]> {
    const regions = diagramRegions(gray);
    if (regions.length === 0) return findDiagrams(gray, model);
    const found: BoardScanResult[] = [];
    for (const region of regions.slice(0, MAX_DIAGRAMS_PER_PAGE)) {
        const { image, x, y } = crop(gray, region);
        let scale = DIAGRAM_WIDTH / (region.x1 - region.x0);
        const scaled = resize(
            image,
            Math.round(image.width * scale),
            Math.round(image.height * scale),
        );
        // a blob can hold two boards that touch
        let reads = await findDiagrams(scaled, model, 2);
        // finely hatched diagrams read best as rendered: resampling turns hatching into moiré
        if (!reads.some((r) => r.reliable)) {
            const asRendered = await findDiagrams(image, model, 2);
            if (asRendered.some((r) => r.reliable) || reads.length === 0) {
                reads = asRendered;
                scale = 1;
            }
        }
        for (const d of reads) {
            found.push({
                ...d,
                corners: {
                    x0: d.corners.x0 / scale + x,
                    x1: d.corners.x1 / scale + x,
                    y0: d.corners.y0 / scale + y,
                    y1: d.corners.y1 / scale + y,
                },
            });
        }
    }
    return readingOrder(found);
}

/**
 * Pages are rendered with this longer side, in pixels. Diagram regions are rescaled before
 * reading anyway; finely hatched diagrams, read as rendered, came out right at this size on
 * A4 test pages (flat-coloured ones at any size from 1400 to 2800).
 */
export const PAGE_SIZE = 2000;
