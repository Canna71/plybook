// Finds the diagrams on book pages off the main thread: recognition takes up to seconds a page,
// and on the main thread no page could be painted meanwhile. A bundled module worker, like
// pdf.js's, so the CSP's 'self' covers it.

import type { GrayImage } from "@scoriiu/fenshot";
import { findDiagramsOnPage } from "./pages";
import { tileModel } from "./model";

export type ScanRequest = { id: number; gray?: GrayImage };

self.onmessage = async (e: MessageEvent<ScanRequest>) => {
    const { id, gray } = e.data;
    try {
        const model = await tileModel();
        // no image: only load the model, ahead of a likely scan
        const found = gray ? await findDiagramsOnPage(gray, model) : [];
        self.postMessage({ id, found });
    } catch (err) {
        self.postMessage({ id, error: String(err) });
    }
};
