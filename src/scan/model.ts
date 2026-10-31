// The tile classifier (onnxruntime-web, all local), shared by the main thread and the page-scan
// worker (scanworker.ts). The model and the WebAssembly runtime are bundled assets, loaded on
// first use; no DOM here, so the worker can import it.

import modelUrl from "@scoriiu/fenshot/model/chess-tiles-v2.onnx?url";
import ortWasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import ortMjsUrl from "onnxruntime-web/ort-wasm-simd-threaded.mjs?url";
import type { TileModel } from "./pages";

let model: Promise<TileModel> | undefined;

export function tileModel(): Promise<TileModel> {
    if (!model) {
        model = (async () => {
            const ort = await import("onnxruntime-web/wasm");
            // one thread: more need SharedArrayBuffer (cross-origin isolation)
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
