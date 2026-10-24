import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { createRequire } from "module";
import { join } from "path";
import { PNG } from "pngjs";
import * as ort from "onnxruntime-web";
import { GrayImage, rgbaToGray } from "@scoriiu/fenshot";
import {
    diagramRegions,
    findDiagrams,
    findDiagramsOnPage,
    maskRegion,
    resize,
    TileModel,
} from "./pages";

const ITALIAN = "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R";

let session: Promise<ort.InferenceSession> | undefined;
const model: TileModel = async (tiles) => {
    if (!session) {
        const require = createRequire(import.meta.url);
        const bytes = readFileSync(
            require.resolve("@scoriiu/fenshot/model/chess-tiles-v2.onnx"),
        );
        session = ort.InferenceSession.create(new Uint8Array(bytes), {
            executionProviders: ["wasm"],
        });
    }
    const out = await (
        await session
    ).run({ tiles: new ort.Tensor("float32", tiles, [64, 1024]) });
    return out["probs"].data as Float32Array;
};

const diagram = () => {
    const png = PNG.sync.read(
        readFileSync(join(__dirname, "fixtures", "fen2image-italian.png")),
    );
    return rgbaToGray(new Uint8ClampedArray(png.data), png.width, png.height);
};

/** A white page with copies of the diagram at the given offsets. */
function page(
    width: number,
    height: number,
    at: [number, number][],
): GrayImage {
    const d = diagram();
    const data = new Float32Array(width * height).fill(255);
    for (const [ox, oy] of at) {
        for (let y = 0; y < d.height; y++) {
            data.set(
                d.data.subarray(y * d.width, (y + 1) * d.width),
                (oy + y) * width + ox,
            );
        }
    }
    return { data, width, height };
}

describe("findDiagramsOnPage", () => {
    it("finds every diagram on a page, in reading order", async () => {
        // two side by side on top, one below on the left
        const found = await findDiagramsOnPage(
            page(1100, 1150, [
                [40, 40],
                [580, 50],
                [40, 620],
            ]),
            model,
        );
        expect(found).toHaveLength(3);
        expect(found.map((f) => f.placement)).toEqual([
            ITALIAN,
            ITALIAN,
            ITALIAN,
        ]);
        const tops = found.map((f) => [
            Math.round(f.corners.x0 / 100),
            Math.round(f.corners.y0 / 100),
        ]);
        expect(tops[0][0]).toBeLessThan(tops[1][0]);
        expect(tops[2][1]).toBeGreaterThan(tops[0][1]);
    }, 60_000);

    it("finds nothing on a blank page", async () => {
        expect(await findDiagramsOnPage(page(600, 800, []), model)).toEqual([]);
    }, 20_000);

    it("still reads a lone board without page around it", async () => {
        const found = await findDiagrams(diagram(), model);
        expect(found.map((f) => f.placement)).toEqual([ITALIAN]);
    }, 20_000);
});

describe("diagramRegions", () => {
    it("finds square blobs and ignores lines of text", () => {
        const W = 800;
        const H = 600;
        const data = new Float32Array(W * H).fill(255);
        const fill = (x0: number, y0: number, w: number, h: number) => {
            for (let y = y0; y < y0 + h; y++)
                data.fill(0, y * W + x0, y * W + x0 + w);
        };
        fill(50, 50, 200, 200); // a "diagram"
        fill(400, 60, 300, 12); // a line of text
        fill(450, 300, 150, 160); // another "diagram"
        const regions = diagramRegions({ data, width: W, height: H });
        expect(regions).toEqual([
            { x0: 48, y0: 48, x1: 256, y1: 256 },
            { x0: 448, y0: 296, x1: 600, y1: 464 },
        ]);
    });
});

it("maskRegion covers a box with the colour around it", () => {
    // a 6x6 white page with a dark 2x2 square in the middle
    const data = new Float32Array(36).fill(255);
    for (const i of [14, 15, 20, 21]) data[i] = 0;
    const img = { data, width: 6, height: 6 };
    const masked = maskRegion(img, { x0: 2, y0: 2, x1: 4, y1: 4 });
    expect([...masked.data].every((v) => v === 255)).toBe(true);
    // the original is untouched
    expect(img.data[14]).toBe(0);
});

describe("resize", () => {
    it("averages when shrinking, so hatching becomes grey", () => {
        // 4x2 stripes of black and white -> 2x1 of mid grey
        const img = {
            data: new Float32Array([0, 255, 0, 255, 0, 255, 0, 255]),
            width: 4,
            height: 2,
        };
        expect([...resize(img, 2, 1).data]).toEqual([127.5, 127.5]);
    });

    it("interpolates when enlarging", () => {
        const img = { data: new Float32Array([0, 100]), width: 2, height: 1 };
        const big = resize(img, 4, 1);
        expect([...big.data]).toEqual([0, 25, 75, 100]);
    });
});
