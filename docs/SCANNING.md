# Position recognition, book scanning and the PDF reader

How Plybook reads chess positions from images, book pages and PDFs (roadmap P4.1, P4.1b, P4.3,
P4.4), what was learned getting it to work, and where to pick it up again. Everything runs
locally in the webview; nothing is uploaded.

## Pieces

| Module | Role |
| --- | --- |
| `@scoriiu/fenshot` 0.1.5 (MIT) | Board detector (`findChessboardCorners`, `snapCorners`), tile extraction, the CNN tile classifier model `chess-tiles-v2.onnx` (1.3 MB, 64 tiles of 32×32 → 13 classes), `recognizeGray`, orientation and FEN helpers. |
| `onnxruntime-web` 1.26 | Runs the model. Single-threaded (`numThreads = 1`): more threads need SharedArrayBuffer, so cross-origin isolation. Wasm paths come from Vite `?url` imports because asset names are hashed. Needs `'wasm-unsafe-eval'` in the CSP. |
| `pdfjs-dist` 6.4 | Renders PDF pages to canvases. Worker via `?url`; image decoders (`wasm/`) and standard fonts are served from `/pdfjs`, copied by `tools/copy-pdfjs-assets.mjs` on `pnpm dev`/`build` (git-ignored). Close a document with `pdf.loadingTask.destroy()` (there is no `PDFDocumentProxy.destroy()` in v6). |
| `src/scan/recognizer.ts` | The one ONNX session (`tileModel()`, loaded lazily, retried on failure), `warmUpScanner()`, `imageToGray(image, maxDim = 1600)`, `scanImage(blob)` for a single screenshot, `scanPage(gray)` for a book page. |
| `src/scan/pages.ts` | Pure (no DOM) multi-diagram logic: regions, frames, scaling, masking, reading order. Tested in Node with the real model. |
| `src/scan/scan.ts` | `scannedPosition(read, turn?)`: orientation (from pawn direction), FEN, legality and the user-facing warnings. |
| `src/scan/pdf.ts` | `openPdf`, `renderPage(pdf, n, longerSide)`, `renderPageWidth(pdf, n, width)`, `pageAspect`, `findText`. |
| `src/scan/capture.ts` + `src-tauri/src/capture.rs` | "Capture from screen" (macOS `screencapture -i`, with a Screen Recording preflight). |
| `src/paste/` | Pasted images go to the scanner; pasted FEN/PGN/Lichess links are text, not recognition. |
| `src/Views/ScanView.tsx` (`/scan`) | One position: paste, file or screen capture → board editor. |
| `src/Views/BookScanView.tsx` (`/scan-book`) | A whole PDF or a set of page images → review cards → `Library/Scanned/<book>/pNNN-i.pgn`, optionally solved by the engine and registered as puzzles (`src/models/scancollection.ts`). |
| `src/Views/PdfReader.tsx` (`/reader?path=`) | The PDF reader with clickable diagrams. |

## Single image (screenshots)

`recognizeGray` from fenshot: detect the board from gradient line peaks, also try a
checkerboard grid-snapped box, classify both, keep the higher mean confidence. A read with no
king for a side (`plausible: false`) is masked and the image rescanned (up to 3 passes).
`reliable` means the weakest tile is at least `CONFIDENCE_FLOOR` (0.7). Large images are
scaled to 1600 px first.

## A book page: `findDiagramsOnPage(gray, model)`

Pages are rendered at `PAGE_SIZE` = 2000 px on the longer side. Then:

1. **Regions** (`diagramRegions`): an 8 px cell grid marks cells with ink (any pixel < 160),
   8-connected components become boxes, kept if roughly square (width/height 0.7–1.4, room for a
   caption) and at least 12% of the page's shorter side. Lines of text fail the ratio test.
   *Why:* fenshot's line search on a whole page pairs one board's columns with another board's
   rows and invents boards. A page with no regions (a screenshot) is scanned whole with
   `findDiagrams`.
2. **Crop** each region with a 5% margin; also make a copy scaled so the region is
   `DIAGRAM_WIDTH` = 520 px wide (box average when shrinking, bilinear when enlarging).
3. **Frame read** (`boardInFrame` + `readInFrame`), added in `fix/book-diagrams`:
   - Coming in from each side, the first row/column whose longest unbroken dark run is
     ≥ 60% of the region (`FRAME_RUN`) is a frame line, looked for within the outer 30%
     (`FRAME_DEPTH`), so coordinates and captions outside the frame are skipped. Lines within
     2% (`FRAME_GAP`) of each other are one (thick or double) frame, capped at 3 gaps so a dark
     board's own rows never pass for a frame.
   - Inside the frame, blank paper is skipped (ink is checked only in the middle half of the
     span inside the frame, so the side frame lines and coordinates don't count).
   - A side without a frame starts at the first ink.
   - That box and `snapCorners` of it are classified; the snap must beat the frame box by
     `SNAP_MARGIN` (0.005 mean confidence) since the frame is usually exact. Only reads with one
     king per side count. Tried as rendered first, then on the 520 px copy if not reliable.
   - *Why:* on framed, hatched diagrams (typical printed books) the detector found no board at
     all at 456 px and was 2–8 px off at other sizes, which misreads pieces. The user confirmed
     the frame read fixed their book (2026-10-25).
4. **Detector read** if the frame read is not reliable: `findDiagrams` (repeated
   `recognizeGray`, masking each board found with the surrounding page colour plus a 4%
   margin; masking with flat grey, as fenshot does, creates new edges) on the 520 px copy, up to
   2 boards per region; if none is reliable, again at the rendered size (fine hatching turns to
   moiré when resampled). The frame read still wins when it is more confident than a single
   detector read.
5. Boxes are mapped back to page coordinates and sorted in **reading order** (rows first: tops
   within half a board share a row).

Each page costs a few model runs (64 tiles each); a framed diagram usually needs 1–2.

## The PDF reader (`PdfReader.tsx`)

- Pages are placeholders sized from the first page's aspect; an IntersectionObserver renders
  pages near the viewport (`renderPageWidth`, at device pixel ratio) and drops far ones.
- Zoom 0.5–3×, page number / previous / next, "Find in the book" (`findText`: pages whose text
  layer contains the query).
- The reading place per book (page, how far down it, zoom) is kept in the `reader.places`
  setting (written as a whole object: Library paths contain dots, so they can't be setting key
  segments); old `reader.pages` entries are read as a fallback. Zoom and window resizes
  re-anchor the view to that place (`anchoring` ignores the scroll events they cause).
- Diagram scan: one page at a time through a module-level promise queue (`scanQueue`); a page
  scrolled away before its turn is skipped and rescanned when it shows again. Each page is
  rendered again at `PAGE_SIZE` for scanning (independent of zoom). Results are kept per page
  as boxes in page fractions (0–1), so the overlay survives zoom; dashed outline = not
  reliable. Results are not persisted: reopening a book scans again.
- Text: `renderTextLayer` (pdf.js `TextLayer`) puts invisible, selectable text over each
  visible page. The layer is sized with CSS `round(down, var(--total-scale-factor) * Wpx, …)`,
  so the page element sets `--total-scale-factor` (CSS px per PDF point) and the SCSS defines
  `--scale-round-x/y`; the rules are a trimmed copy of `pdfjs-dist/web/pdf_viewer.css`
  `.textLayer`. Diagram buttons sit above it (`z-index: 2`).
- Clicking a box (`pickDiagram`) opens the diagram's notes in the side panel; Analyze, Play
  from here, Find in databases and Edit (`/boardeditor?fen=`) are the only ways out of the book.
- Notes (P4.4c/d): a diagram's notes are `Library/Scanned/<collectionName(book)>/pNNN-i.pgn`
  (`diagramFileName`, `diagramPgn` in `src/models/scancollection.ts`), shared with "Scan a
  whole book". They are edited in `GameManager` with `compact` (board above the moves) inside
  the panel, keyed on the file so each diagram gets a fresh editor. `onNotesChange` saves
  (debounced, and flushed when another diagram is picked or the reader closes) only when the
  PGN differs from `baseline`: the editor re-serializes a PGN as it loads it, so for 500 ms
  after loading its output becomes the baseline, and both sides are compared through
  `normalPgn`. Nothing is written for a diagram that was only looked at.
- `GameManager`'s `onReady` hands the reader a `GameManagerApi`: `addComment(text)` (on the
  move shown; `GameModel.insertComment(…, atEnd)`) and `addMovesFromText(text)`.
- Selected text is tracked with a `selectionchange` listener (the last non-empty selection
  inside the pages, with its page), so clicking a button doesn't lose it; `bookQuote` makes the
  comment. App.scss turns selection off everywhere, so the text layer needs
  `-webkit-user-select: text` (WebKit ignores the unprefixed property there).
- Chess in the text (P4.4e, `src/models/booktext.ts`): `pageTextItems` gives the page's text
  runs with boxes in page fractions (cached per page); `textNearDiagram` takes the caption
  (6% of the page below the diagram, in its column) and the following text (30%);
  `turnFromText` sets the side to move; `movesFromText` finds the longest run of moves that
  can be played from a position (figurines, `0-0`, numbers must match the side to move,
  words between moves end a run, bracketed side lines dropped). An unreadable symbol right
  before a move is a chess-font piece: `runFrom` tries each piece for it, keeps each symbol to
  one piece through the line, and `agreed` takes the longest reading, stopping where equally
  long readings differ. Open problems: P4.4f in the roadmap.
- The game before a diagram (F.11, `src/models/gamebefore.ts`): the text before it (the
  `PAGES_BEFORE` = 3 pages before, then its page up to the diagram, `readingOrder` going column
  by column and line by line; lines by baseline, runs that touch joined, as OCR splits "t'lJ" +
  "f3"). An OCR text layer turns chess-font pieces into junk ("tlJf3", "i.c4", "'iVe7") and
  digits into letters ("cS", "fl", "S d4", "1 0"), so `textMoves` reads a move only by its
  square, capture and pawn-or-piece, and keeps only numbered moves (ply from the number, "..."
  for Black). `gameBefore` then searches from the initial position, ply by ply, for moves from
  the text in order that reach the diagram's board: a beam of the 1,500 positions closest to
  the diagram (each kept at its earliest point in the text), pruned when a side has fewer
  pieces of a kind than the diagram or a diagram pawn is out of reach (pawns don't go back).
  The diagram decides the reading, so a wrong guess can't be offered; a transposition can
  (another order of the book's moves to the same board). Measured on an OCR'd Gambit book
  (Collins): eight diagrams from 6 to 26 plies, each under 0.35 s. `withGameBefore` writes the
  notes from the start, the line, a "Diagram, p. N" comment and the `DiagramPly` header, which
  `notesStart` reads for whose move it is and the reader for the move to show
  (`GameManagerApi.showPly`).
- The editor's `previewMovesFromText` (reactive: it reads the editor's game and path) shows
  what a text would add before it's added: the text below the diagram, and the selection
  ("As moves: …"), each with its own buttons.
- Library: "Add PDF…" in a folder copies the file into the Library (`writeDataFile` takes
  bytes); `.pdf` files open in the reader from the folder view and the sidebar tree.

## Testing

- `pnpm test` runs `src/scan/pages.test.ts` and `scan.test.ts` in Node with the real ONNX model
  (`onnxruntime-web` works in Node; `vitest.config.ts` inlines fenshot). Fixtures:
  `src/scan/fixtures/fen2image-italian.png` (a hatched, unframed diagram) and
  `lichess-italian-black.png`.
- Book-like cases are **synthesised** from the fixture (copies on a white page, frames, gaps,
  coordinate marks, captions, `resize` to other sizes): see "reads a framed diagram…". Keep
  copyrighted book pages out of the repo and out of tests; for a one-off check, let the owner
  run the app on their book.
- To exercise pdf.js in Node (done for P4.3 with generated A4 PDFs): install `@napi-rs/canvas`
  temporarily (it is not a dependency), import `pdfjs-dist/legacy/build/pdf.mjs`, and pass
  `wasmUrl: "node_modules/pdfjs-dist/wasm/"` (needed for JPX/JBIG2 images, common in scanned
  books).
- A quick exploration harness: a throwaway `src/scan/zz_*.test.ts` that loops over sizes /
  frame styles and logs placement, mean confidence and box offsets; delete it before committing.

## Known limits and ideas for later

Recognition:
- **Side to move** is a guess (the side at the bottom). Books say it in the caption or text
  ("White to play", "1...", a ▲/△ marker, a number with "..."); reading the text layer near
  the diagram (pdf.js `getTextContent` with positions) would fix most. Fits the planned
  "recognize positions and moves from the text" item.
- Pieces in unusual fonts or very small diagrams can still be misread; the model was trained
  on lichess/chess.com sets, flat boards and hatched book boards. A per-book check ("these 3
  reads were unsure") or fine-tuning would be the next step.
- `diagramRegions` drops regions outside the 0.7–1.4 ratio, so two boards that touch side by
  side (ratio ~2) are missed; splitting wide regions in halves would recover them.
- Diagrams without any frame and with light edge squares rely on the first ink; a board whose
  edge rank/file is empty and light could be cropped short (the grid snap and detector still
  compete).
- Scanned (image-only) PDFs: no text layer, so Find and text-based ideas don't apply; the
  images may be skewed (no deskew yet).
- 3D/photographed boards are not supported.

Performance:
- Whole pages (the PDF reader and the book scan) are scanned in a module Web Worker
  (`scanworker.ts`, the model in `model.ts`). Detection takes up to about 1.7 s a page, and on
  the main thread the reader could paint nothing meanwhile. The page is still drawn and
  turned grey on the main thread (pdf.js needs a canvas), and the grey pixels are transferred
  to the worker. The worker is a bundled asset, so the CSP's `script-src 'self'` covers it; it
  needs Vite's `worker.format: "es"` (the ONNX runtime is a dynamic import). If the worker
  can't start, scans fall back to the main thread. Single images (Scan a position) still
  run on the main thread. ONNX stays single-threaded inside the worker.
- The reader draws a page only after it has been in view for 120 ms, cancels the drawing when
  it leaves, and scans only once the visible pages are drawn. The last 12 pages keep their
  canvas.
- Caching scan results per book (SQLite, keyed by file hash + page) would make reopening a
  book instant.

Reader (see the P4.4 follow-ups in `docs/ROADMAP.md`): exact position memory, text selection,
copying text into annotations, a PGN per position, positions and moves from the text.
