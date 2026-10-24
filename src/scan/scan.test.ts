import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { createRequire } from "module";
import { join } from "path";
import { PNG } from "pngjs";
import * as ort from "onnxruntime-web";
import {
    extractTiles,
    probsToPlacement,
    recognizeGray,
    rgbaToGray,
} from "@scoriiu/fenshot";
import { scannedPosition } from "./scan";

// Fixtures from github.com/scoriiu/fenshot (MIT): a generated diagram and a Lichess screenshot
// seen from Black's side, both of the Italian Game after 3... Bc5
const ITALIAN = "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R";

let session: Promise<ort.InferenceSession> | undefined;
const getSession = () => {
    if (!session) {
        const require = createRequire(import.meta.url);
        const model = readFileSync(
            require.resolve("@scoriiu/fenshot/model/chess-tiles-v2.onnx"),
        );
        session = ort.InferenceSession.create(new Uint8Array(model), {
            executionProviders: ["wasm"],
        });
    }
    return session;
};

/** The real pipeline: detection, the model under onnxruntime, arbitration. */
async function recognizeFixture(name: string) {
    const png = PNG.sync.read(readFileSync(join(__dirname, "fixtures", name)));
    const gray = rgbaToGray(
        new Uint8ClampedArray(png.data),
        png.width,
        png.height,
    );
    const s = await getSession();
    return recognizeGray(gray, async (corners) => {
        const out = await s.run({
            tiles: new ort.Tensor(
                "float32",
                extractTiles(gray, corners),
                [64, 1024],
            ),
        });
        return probsToPlacement(out["probs"].data as Float32Array);
    });
}

describe("scanning screenshots", () => {
    it("reads a book-style diagram", async () => {
        const read = (await recognizeFixture("fen2image-italian.png"))!;
        const position = scannedPosition(read);
        expect(position.fen.split(" ")[0]).toBe(ITALIAN);
        expect(position.orientation).toBe("white");
        expect(position).toMatchObject({ legal: true, warnings: [] });
    }, 20_000);

    it("turns a screenshot taken from Black's side the right way up", async () => {
        const read = (await recognizeFixture("lichess-italian-black.png"))!;
        const position = scannedPosition(read);
        expect(position.fen.split(" ")[0]).toBe(ITALIAN);
        expect(position.orientation).toBe("black");
        // the side at the bottom moves by default
        expect(position.fen.split(" ")[1]).toBe("b");
    }, 20_000);
});

describe("scannedPosition", () => {
    const read = { placement: ITALIAN, reliable: true, minConfidence: 0.99 };

    it("can be told whose move it is", () => {
        expect(scannedPosition(read, "black").fen.split(" ")[1]).toBe("b");
        // castling rights come from kings and rooks on their home squares
        expect(scannedPosition(read).fen.split(" ")[2]).toBe("KQkq");
        const rookMoved = { ...read, placement: ITALIAN.replace(/R$/, "1") };
        expect(scannedPosition(rookMoved).fen.split(" ")[2]).toBe("Qkq");
    });

    it("warns about unsure reads and impossible positions", () => {
        const empty = scannedPosition({
            placement: "8/8/8/8/8/8/8/8",
            reliable: false,
            minConfidence: 0.4,
        });
        expect(empty.legal).toBe(false);
        expect(empty.warnings).toHaveLength(2);
    });
});
