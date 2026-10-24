// Screenshot recognition in the webview (fenshot + onnxruntime-web, all local). The model and
// the WebAssembly runtime are bundled assets, loaded on the first scan.

import { createRecognizer } from "@scoriiu/fenshot";
import modelUrl from "@scoriiu/fenshot/model/chess-tiles-v2.onnx?url";
import ortWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import ortMjsUrl from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";
import { scannedPosition, ScannedPosition } from "./scan";

let recognizer: ReturnType<typeof createRecognizer> | undefined;

async function getRecognizer() {
    if (!recognizer) {
        // one thread: no workers, which the CSP would have to allow; a board takes milliseconds
        const ort = await import("onnxruntime-web/wasm");
        ort.env.wasm.numThreads = 1;
        recognizer = createRecognizer({
            modelUrl,
            // file paths instead of a folder prefix: Vite names the assets with hashes
            wasmPaths: {
                mjs: ortMjsUrl,
                wasm: ortWasmUrl,
            } as unknown as string,
        });
    }
    return recognizer;
}

/** Loads the runtime ahead of a likely scan. */
export function warmUpScanner() {
    void getRecognizer().then((r) => r.warmUp());
}

/** The position in an image, or undefined if no chessboard was found. */
export async function scanImage(
    image: Blob,
): Promise<ScannedPosition | undefined> {
    const result = await (await getRecognizer()).recognize(image);
    return result ? scannedPosition(result) : undefined;
}
