// Board recognition in the webview (fenshot + onnxruntime-web, all local). Single images are read
// here; whole book pages in a worker (scanworker.ts), so the reader keeps painting meanwhile.

import {
    BoardScanResult,
    GrayImage,
    recognizeGray,
    rgbaToGray,
} from "@scoriiu/fenshot";
import anylogger from "anylogger";
import { classifierFor, findDiagramsOnPage } from "./pages";
import { tileModel } from "./model";
import { scannedPosition, ScannedPosition } from "./scan";
import type { ScanRequest } from "./scanworker";

const log = anylogger("recognizer");

/** Detection works on moderate resolutions; larger images are scaled down first. */
const MAX_DETECT_DIM = 1600;

type ScanReply = { id: number; found?: BoardScanResult[]; error?: string };

let worker: Worker | undefined;
let workerFailed = false;
let nextId = 0;
const pending = new Map<number, (reply: ScanReply) => void>();

/** The page-scan worker, started on first use; undefined where none can start. */
function scanWorker(): Worker | undefined {
    if (worker || workerFailed) return worker;
    try {
        worker = new Worker(new URL("./scanworker.ts", import.meta.url), {
            type: "module",
        });
        worker.onmessage = (e: MessageEvent<ScanReply>) => {
            pending.get(e.data.id)?.(e.data);
            pending.delete(e.data.id);
        };
        worker.onerror = (e) => {
            log.warn(
                "scan worker failed; scanning on the main thread",
                e.message,
            );
            workerFailed = true;
            worker?.terminate();
            worker = undefined;
            for (const resolve of pending.values())
                resolve({ id: -1, error: "scan worker failed" });
            pending.clear();
        };
    } catch (err) {
        log.warn("no scan worker; scanning on the main thread", err);
        workerFailed = true;
    }
    return worker;
}

function askWorker(w: Worker, gray?: GrayImage): Promise<ScanReply> {
    const id = nextId++;
    return new Promise((resolve) => {
        pending.set(id, resolve);
        const request: ScanRequest = { id, gray };
        // the pixels move to the worker instead of being copied
        w.postMessage(request, gray ? [gray.data.buffer] : []);
    });
}

/** Loads the runtime ahead of a likely scan, in the worker that will scan pages. */
export function warmUpScanner() {
    const w = scanWorker();
    if (w) void askWorker(w);
    else void tileModel().catch(() => undefined);
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

/**
 * Every diagram on a page (rendered by the caller), in reading order. `gray` is handed to the
 * worker: don't use it afterwards.
 */
export async function scanPage(gray: GrayImage): Promise<BoardScanResult[]> {
    const w = scanWorker();
    if (w) {
        const reply = await askWorker(w, gray);
        if (reply.found) return reply.found;
        if (!workerFailed) throw new Error(reply.error);
        // the worker died with this page: the main thread no longer has its pixels
        throw new Error("page scan interrupted");
    }
    return findDiagramsOnPage(gray, await tileModel());
}
