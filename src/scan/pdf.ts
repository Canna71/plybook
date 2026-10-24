// Rendering PDF pages in the webview with pdf.js. The worker is a bundled asset; image decoders
// and standard fonts are served from /pdfjs (copied there by tools/copy-pdfjs-assets.mjs).

import { getDocument, GlobalWorkerOptions, PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfDocument = PDFDocumentProxy;

/** Opens a PDF the user picked (its bytes stay in memory; nothing is uploaded). */
export async function openPdf(file: Blob): Promise<PdfDocument> {
    return getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
        wasmUrl: "/pdfjs/wasm/",
        standardFontDataUrl: "/pdfjs/standard_fonts/",
    }).promise;
}

/** Renders page `number` (from 1) onto a new canvas whose longer side is `size` pixels. */
export async function renderPage(
    pdf: PdfDocument,
    number: number,
    size: number,
): Promise<HTMLCanvasElement> {
    const page = await pdf.getPage(number);
    const unscaled = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
        scale: size / Math.max(unscaled.width, unscaled.height),
    });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    // a white page: transparent areas would read as black
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, viewport }).promise;
    page.cleanup();
    return canvas;
}
