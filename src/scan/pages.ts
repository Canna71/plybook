// Every diagram on a page: fenshot reads one board per pass, so each board found is covered
// up and the page is scanned again, until nothing more turns up.

import {
    BoardCorners,
    BoardScanResult,
    CONFIDENCE_FLOOR,
    extractTiles,
    GrayImage,
    probsToPlacement,
    recognizeGray,
    snapCorners,
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

/** A frame line is an unbroken dark run at least this share of the region long */
const FRAME_RUN = 0.6;
/** Frame lines this close (a share of the region) belong to one frame: a thick or double one */
const FRAME_GAP = 0.02;
/** Frames, coordinates and captions are looked for this far into the region from each side */
const FRAME_DEPTH = 0.3;

function isLine(
    gray: GrayImage,
    at: number,
    from: number,
    to: number,
    vertical: boolean,
) {
    let run = 0;
    let longest = 0;
    for (let i = from; i < to; i++) {
        const v = vertical
            ? gray.data[i * gray.width + at]
            : gray.data[at * gray.width + i];
        run = v < INK ? run + 1 : 0;
        longest = Math.max(longest, run);
    }
    return longest >= FRAME_RUN * (to - from);
}

/** Ink in the middle half of a row or column: coordinates stay outside it */
function hasInk(
    gray: GrayImage,
    at: number,
    from: number,
    to: number,
    vertical: boolean,
) {
    const side = Math.round((to - from) * 0.25);
    for (let i = from + side; i < to - side; i++) {
        const v = vertical
            ? gray.data[i * gray.width + at]
            : gray.data[at * gray.width + i];
        if (v < INK) return true;
    }
    return false;
}

/**
 * Coming in from one side of a region, the first row or column inside its frame (past
 * coordinates and captions outside it); undefined when that side has no frame.
 */
function insideFrame(
    line: (i: number) => boolean,
    start: number,
    step: 1 | -1,
    extent: number,
) {
    const depth = Math.round(extent * FRAME_DEPTH);
    const gap = Math.max(2, Math.round(extent * FRAME_GAP));
    let i = start;
    while (Math.abs(i - start) < depth && !line(i)) i += step;
    if (Math.abs(i - start) >= depth) return undefined;
    // a frame is thin: a dark board's rows must not pass for one
    let last = i;
    for (
        let j = i + step;
        Math.abs(j - last) <= gap && Math.abs(j - i) <= 3 * gap;
        j += step
    ) {
        if (line(j)) last = j;
    }
    return last + step;
}

/** From `start` inward, the first row or column with ink, looking at most `limit` far. */
function firstInk(
    ink: (i: number) => boolean,
    start: number,
    step: 1 | -1,
    limit: number,
) {
    for (let i = start; Math.abs(i - start) <= limit; i += step) {
        if (ink(i)) return i;
    }
    return start;
}

/**
 * The board inside a diagram region. Books frame their diagrams, often with coordinates and a
 * caption around them; the detector's grid search is thrown off by the frame lines, so the
 * frame itself gives the board. Without a frame, the board is where the ink starts.
 */
export function boardInFrame(
    gray: GrayImage,
    region: BoardCorners,
): BoardCorners {
    const { x0, y0, x1, y1 } = region;
    const w = x1 - x0;
    const h = y1 - y0;
    const row = (y: number) => isLine(gray, y, x0, x1, false);
    const col = (x: number) => isLine(gray, x, y0, y1, true);
    const top = insideFrame(row, y0, 1, h);
    const bottom = insideFrame(row, y1 - 1, -1, h);
    const left = insideFrame(col, x0, 1, w);
    const right = insideFrame(col, x1 - 1, -1, w);
    // within the frame, skip any paper before the squares
    const t = top ?? y0;
    const b = (bottom ?? y1 - 1) + 1;
    const l = left ?? x0;
    const r = (right ?? x1 - 1) + 1;
    const rowInk = (y: number) => hasInk(gray, y, l, r, false);
    const colInk = (x: number) => hasInk(gray, x, t, b, true);
    const gap = Math.max(2, Math.round(Math.max(w, h) * FRAME_GAP));
    const limit = (framed: number | undefined, extent: number) =>
        framed === undefined ? Math.round(extent * FRAME_DEPTH) : gap;
    return {
        x0: firstInk(colInk, l, 1, limit(left, w)),
        y0: firstInk(rowInk, t, 1, limit(top, h)),
        x1: firstInk(colInk, r - 1, -1, limit(right, w)) + 1,
        y1: firstInk(rowInk, b - 1, -1, limit(bottom, h)) + 1,
    };
}

const isPosition = (placement: string) =>
    [...placement].filter((c) => c === "K").length === 1 &&
    [...placement].filter((c) => c === "k").length === 1;

/** The grid snap must beat the frame by this much mean confidence: the frame is usually exact */
const SNAP_MARGIN = 0.005;

/** The board in a frame, read in place and grid-snapped; the more confident read wins. */
async function readInFrame(
    gray: GrayImage,
    box: BoardCorners,
    model: TileModel,
): Promise<BoardScanResult | undefined> {
    const classify = classifierFor(gray, model);
    let best: BoardScanResult | undefined;
    for (const corners of [box, snapCorners(gray, box)]) {
        const read = await classify(corners);
        if (!isPosition(read.placement)) continue;
        if (best && best.meanConfidence + SNAP_MARGIN >= read.meanConfidence)
            continue;
        best = {
            ...read,
            corners,
            reliable: read.minConfidence >= CONFIDENCE_FLOOR,
            plausible: true,
        };
    }
    return best;
}

const scaleBox = (b: BoardCorners, s: number, dx = 0, dy = 0) => ({
    x0: b.x0 * s + dx,
    y0: b.y0 * s + dy,
    x1: b.x1 * s + dx,
    y1: b.y1 * s + dy,
});

/** Diagram width the detector reads best; each region is scaled to it before reading. */
export const DIAGRAM_WIDTH = 520;

/** The more confident of two reads, either of which may be missing. */
const moreConfident = (a?: BoardScanResult, b?: BoardScanResult) =>
    !a || (b && b.meanConfidence > a.meanConfidence) ? b : a;

/**
 * Every diagram on a book page: the board inside each square-ish blob of ink is read where its
 * frame puts it, and the blob is also scanned by the detector, both as rendered and scaled to
 * DIAGRAM_WIDTH, so frames, diagram size and print resolution matter little. A page without
 * such blobs (a screenshot, say) is scanned as a whole.
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
        const scale = DIAGRAM_WIDTH / (region.x1 - region.x0);
        const scaled = resize(
            image,
            Math.round(image.width * scale),
            Math.round(image.height * scale),
        );
        // reads in the crop's own pixels
        const unscale = (d: BoardScanResult) => ({
            ...d,
            corners: scaleBox(d.corners, 1 / scale),
        });
        const box = boardInFrame(image, scaleBox(region, 1, -x, -y));
        // finely hatched diagrams read best as rendered: resampling turns hatching into moiré
        let framed = await readInFrame(image, box, model);
        if (!framed?.reliable) {
            const read = await readInFrame(scaled, scaleBox(box, scale), model);
            framed = moreConfident(framed, read && unscale(read));
        }
        let reads: BoardScanResult[] = framed?.reliable ? [framed] : [];
        if (reads.length === 0) {
            // a blob can hold two boards that touch, which only the detector separates
            reads = (await findDiagrams(scaled, model, 2)).map(unscale);
            if (!reads.some((r) => r.reliable)) {
                const asRendered = await findDiagrams(image, model, 2);
                if (asRendered.some((r) => r.reliable) || reads.length === 0) {
                    reads = asRendered;
                }
            }
            const single = reads.length === 1 ? reads[0] : undefined;
            if (
                reads.length < 2 &&
                framed &&
                moreConfident(single, framed) === framed
            ) {
                reads = [framed];
            }
        }
        for (const d of reads) {
            found.push({ ...d, corners: scaleBox(d.corners, 1, x, y) });
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
