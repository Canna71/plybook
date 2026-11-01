// Rendering PDF pages in the webview with pdf.js. The worker is a bundled asset; image decoders
// and standard fonts are served from /pdfjs (copied there by tools/copy-pdfjs-assets.mjs).

import {
    getDocument,
    GlobalWorkerOptions,
    PDFDocumentProxy,
    TextLayer,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { TextItem } from "../models/booktext";

GlobalWorkerOptions.workerSrc = workerUrl;

export type PdfDocument = PDFDocumentProxy;
export type PdfTextLayer = TextLayer;

/** Opens a PDF the user picked (its bytes stay in memory; nothing is uploaded). */
export async function openPdf(file: Blob): Promise<PdfDocument> {
    return getDocument({
        data: new Uint8Array(await file.arrayBuffer()),
        wasmUrl: "/pdfjs/wasm/",
        standardFontDataUrl: "/pdfjs/standard_fonts/",
    }).promise;
}

/** Renders page `number` (from 1) onto a new canvas whose longer side is `size` pixels. */
export const renderPage = (pdf: PdfDocument, number: number, size: number) =>
    render(pdf, number, (w, h) => size / Math.max(w, h));

/** A page being drawn for reading: `cancel` stops it (scrolled away), and `canvas` rejects */
export type PageRender = {
    canvas: Promise<HTMLCanvasElement>;
    cancel: () => void;
};

/**
 * Renders page `number` (from 1) onto a new canvas `width` pixels wide, for reading. A plain
 * GPU canvas (no pixels read back), and cancellable: pages scrolled past must not keep the
 * worker busy while the page the reader stopped on waits.
 */
export function renderPageWidth(
    pdf: PdfDocument,
    number: number,
    width: number,
): PageRender {
    let cancelled = false;
    let task: { cancel: () => void } | undefined;
    const canvas = (async () => {
        const page = await pdf.getPage(number);
        if (cancelled) throw new Error("cancelled");
        const unscaled = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: width / unscaled.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const rendering = page.render({ canvas, viewport });
        task = rendering;
        await rendering.promise;
        page.cleanup();
        return canvas;
    })();
    return {
        canvas,
        cancel: () => {
            cancelled = true;
            task?.cancel();
        },
    };
}

/**
 * Lays the page's text, invisible but selectable, over its canvas in `container`. Sized by the
 * container's `--total-scale-factor` (CSS pixels per PDF point), so zooming needs no new layer.
 */
export async function renderTextLayer(
    pdf: PdfDocument,
    number: number,
    container: HTMLElement,
): Promise<TextLayer> {
    const page = await pdf.getPage(number);
    const layer = new TextLayer({
        textContentSource: page.streamTextContent(),
        container,
        viewport: page.getViewport({ scale: 1 }),
    });
    await layer.render();
    return layer;
}

/** The text runs of a page, with their boxes in fractions of the page (from the top left). */
export async function pageTextItems(
    pdf: PdfDocument,
    number: number,
): Promise<TextItem[]> {
    const page = await pdf.getPage(number);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: TextItem[] = [];
    for (const item of content.items) {
        if (!("str" in item) || !item.str.trim()) continue;
        const [, , , , x, y] = item.transform;
        const [ax, ay] = viewport.convertToViewportPoint(x, y);
        const [bx, by] = viewport.convertToViewportPoint(
            x + item.width,
            y + item.height,
        );
        items.push({
            str: item.str,
            x0: Math.min(ax, bx) / viewport.width,
            x1: Math.max(ax, bx) / viewport.width,
            y0: Math.min(ay, by) / viewport.height,
            y1: Math.max(ay, by) / viewport.height,
        });
    }
    return items;
}

/** Height / width of a page. */
export async function pageAspect(pdf: PdfDocument, number: number) {
    const viewport = (await pdf.getPage(number)).getViewport({ scale: 1 });
    return viewport.height / viewport.width;
}

/** The pages (from 1) whose text contains `query`, ignoring case; at most `max`. */
export async function findText(
    pdf: PdfDocument,
    query: string,
    max = 50,
): Promise<number[]> {
    const wanted = query.trim().toLowerCase();
    const pages: number[] = [];
    if (!wanted) return pages;
    for (let n = 1; n <= pdf.numPages && pages.length < max; n++) {
        const content = await (await pdf.getPage(n)).getTextContent();
        const text = content.items
            .map((item) => ("str" in item ? item.str : ""))
            .join(" ")
            .toLowerCase();
        if (text.includes(wanted)) pages.push(n);
    }
    return pages;
}

async function render(
    pdf: PdfDocument,
    number: number,
    scaleFor: (width: number, height: number) => number,
): Promise<HTMLCanvasElement> {
    const page = await pdf.getPage(number);
    const unscaled = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({
        scale: scaleFor(unscaled.width, unscaled.height),
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
