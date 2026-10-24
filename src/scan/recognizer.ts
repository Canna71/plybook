// Board recognition in the webview (fenshot + onnxruntime-web, all local). The model and the
// WebAssembly runtime are bundled assets, loaded on the first scan; one session serves single
// images and whole book pages.

import {
    BoardScanResult,
    GrayImage,
    recognizeGray,
    rgbaToGray,
} from "@scoriiu/fenshot";
import modelUrl from "@scoriiu/fenshot/model/chess-tiles-v2.onnx?url";
import ortWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import ortMjsUrl from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";
import { classifierFor, findDiagramsOnPage, TileModel } from "./pages";
import { scannedPosition, ScannedPosition } from "./scan";

/** Detection works on moderate resolutions; larger images are scaled down first. */
const MAX_DETECT_DIM = 1600;

let model: Promise<TileModel> | undefined;

function tileModel(): Promise<TileModel> {
    if (!model) {
        model = (async () => {
            const ort = await import("onnxruntime-web/wasm");
            // one thread: no workers, which the CSP would have to allow
            ort.env.wasm.numThreads = 1;
            // file paths instead of a folder prefix: Vite names the assets with hashes
            ort.env.wasm.wasmPaths = { mjs: ortMjsUrl, wasm: ortWasmUrl };
            const session = await ort.InferenceSession.create(modelUrl, {
                executionProviders: ["wasm"],
            });
            return async (tiles: Float32Array) => {
                const out = await session.run({
                    tiles: new ort.Tensor("float32", tiles, [64, 1024]),
                });
                return out["probs"].data as Float32Array;
            };
        })();
        // a failed start is retried on the next scan
        model.catch(() => (model = undefined));
    }
    return model;
}

/** Loads the runtime ahead of a likely scan. */
export function warmUpScanner() {
    void tileModel().catch(() => undefined);
}

/** The grey image the detector reads, scaled down to at most `maxDim`. */
export function imageToGray(
    image: CanvasImageSource & { width: number; height: number },
    maxDim = MAX_DETECT_DIM,
): GrayImage {
    const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return rgbaToGray(pixels.data, canvas.width, canvas.height);
}

/** The position in an image, or undefined if no chessboard was found. */
export async function scanImage(
    image: Blob,
): Promise<ScannedPosition | undefined> {
    const bitmap = await createImageBitmap(image);
    const gray = imageToGray(bitmap);
    bitmap.close();
    const result = await recognizeGray(
        gray,
        classifierFor(gray, await tileModel()),
    );
    return result ? scannedPosition(result) : undefined;
}

/** Every diagram on a page (rendered by the caller), in reading order. */
export async function scanPage(gray: GrayImage): Promise<BoardScanResult[]> {
    return findDiagramsOnPage(gray, await tileModel());
}
