import {
    Accessor,
    Component,
    createEffect,
    createResource,
    createSignal,
    For,
    on,
    onCleanup,
    onMount,
    Show,
} from "solid-js";
import { createStore } from "solid-js/store";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { Chess, Color, Move } from "chessops";
import { parseFen } from "chessops/fen";
import { makeSanVariation } from "chessops/san";
import { TextItem, textNearDiagram, turnFromText } from "../models/booktext";
import { Config } from "chessground/config";
import anylogger from "anylogger";
import { Chessboard } from "../components/common/chessboard";
import Button from "../components/common/Button";
import { getSettingValue, setSettingValue } from "../models/settings";
import { PAGE_SIZE } from "../scan/pages";
import {
    findText,
    openPdf,
    pageAspect,
    PdfDocument,
    PageRender,
    PdfTextLayer,
    renderPage,
    renderPageWidth,
    pageTextItems,
    renderTextLayer,
} from "../scan/pdf";
import { imageToGray, scanPage, warmUpScanner } from "../scan/recognizer";
import { ScanRead, scannedPosition } from "../scan/scan";
import {
    baseName,
    listAppData,
    NameWithoutExtension,
    readDataBytes,
    readDataFile,
    writeDataFile,
} from "../storage/fs";
import {
    bookQuote,
    collectionName,
    diagramFileName,
    diagramPgn,
    diagramPly,
    normalPgn,
    notesStart,
    restartedNotes,
    withGameBefore,
    withOrientation,
} from "../models/scancollection";
import {
    gameBefore,
    PAGES_BEFORE,
    textBeforeDiagram,
} from "../models/gamebefore";
import GameManager, { GameManagerApi } from "../components/game/GameManager";
import { join } from "@tauri-apps/api/path";
import { BaseDirectory, exists, mkdir } from "@tauri-apps/plugin-fs";
import { makeToast } from "../components/common/Toast";
import { recordRecent } from "../storage/recent";
import "./PdfReader.scss";
const log = anylogger("reader");

const PLACES_SETTING = "reader.places";
const PAGES_SETTING = "reader.pages";
/** The narrowest notes column and book the divider leaves (F.24) */
const MIN_SIDE = 300;
const MIN_PAGES = 320;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

/** A diagram on a page, its box in fractions of the page (0–1). */
type PageDiagram = {
    page: number;
    /** Order on the page, from 1 */
    index: number;
    read: ScanRead;
    box: { x0: number; y0: number; x1: number; y1: number };
    orientation: Color;
};

// one page scan at a time: fast scrolling queues pages, and pages scrolled past are skipped
let scanQueue: Promise<unknown> = Promise.resolve();

// the pages being drawn for reading: diagram scans wait until there are none, so a page the
// reader looks at never waits behind a scan (both use the pdf.js worker and the main thread)
const [pageRenders, setPageRenders] = createSignal(0);
const pagesDrawn = () =>
    new Promise<void>((resolve) => {
        const check = () =>
            pageRenders() === 0 ? resolve() : setTimeout(check, 100);
        check();
    });

/** Canvases kept for pages scrolled away from, so going back shows them at once */
const KEPT_PAGES = 12;
/** How long a page must stay in view before it is drawn: fast scrolling draws nothing */
const SETTLE_MS = 120;

/**
 * Reads a PDF from the Library: pages render as they scroll into view; the diagrams on each
 * page are found in the background and can be clicked to study the position.
 */
const PdfReader: Component = () => {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const path = () => (typeof params.path === "string" ? params.path : "");

    const [loaded] = createResource(path, async (p) => {
        const pdf = await openPdf(
            new Blob([new Uint8Array(await readDataBytes(p)).buffer]),
        );
        recordRecent(p, "book");
        return pdf;
    });
    // reading a failed resource throws its error, which would stop the whole app (F.40): the
    // book is read through this, and the failure is shown on its own
    const doc = () => (loaded.error ? undefined : loaded());
    const [aspect] = createResource(doc, (d) => pageAspect(d, 1));
    onCleanup(() => void doc()?.loadingTask.destroy());

    const [zoom, setZoom] = createSignal(1);
    const [width, setWidth] = createSignal(800);
    const [current, setCurrent] = createSignal(1);
    const [diagrams, setDiagrams] = createStore<Record<number, PageDiagram[]>>(
        {},
    );
    const [showDiagrams, setShowDiagrams] = createSignal(true);
    const [selected, setSelected] = createSignal<
        PageDiagram & {
            turn: Color;
            /** The text below the diagram, which may give its moves */
            following?: string;
        }
    >();
    const [query, setQuery] = createSignal("");
    const [matches, setMatches] = createSignal<number[]>();
    const [searching, setSearching] = createSignal(false);

    let scroller!: HTMLDivElement;
    let body!: HTMLDivElement;
    const pageElements: HTMLDivElement[] = [];

    // #region the divider between the book and the notes (F.24): 0 keeps the CSS width
    const [sideWidth, setSideWidth] = createSignal(
        getSettingValue("reader.sideWidth", 0),
    );
    const dragDivider = (e: PointerEvent) => {
        const handle = e.currentTarget as HTMLElement;
        handle.setPointerCapture(e.pointerId);
        e.preventDefault();
        const move = (ev: PointerEvent) => {
            const right = body.getBoundingClientRect().right;
            // room for the notes' board, and for a readable page
            const max = Math.max(MIN_SIDE, body.clientWidth - MIN_PAGES);
            setSideWidth(
                Math.round(
                    Math.min(max, Math.max(MIN_SIDE, right - ev.clientX)),
                ),
            );
        };
        const up = () => {
            handle.removeEventListener("pointermove", move);
            handle.removeEventListener("pointerup", up);
            void setSettingValue("reader.sideWidth", sideWidth());
        };
        handle.addEventListener("pointermove", move);
        handle.addEventListener("pointerup", up);
    };
    const resetDivider = () => {
        setSideWidth(0);
        void setSettingValue("reader.sideWidth", 0);
    };
    // #endregion

    onMount(() => {
        warmUpScanner();
        const resize = new ResizeObserver(() =>
            setWidth(scroller.clientWidth - 32),
        );
        resize.observe(scroller);
        onCleanup(() => resize.disconnect());
    });

    // #region reading place: kept through zoom and resizing, remembered per book
    const visibility = new Map<number, number>();
    const onVisibility = (n: number, ratio: number) => {
        visibility.set(n, ratio);
        let best = current();
        let bestRatio = -1;
        for (const [page, r] of visibility) {
            if (r > bestRatio) {
                best = page;
                bestRatio = r;
            }
        }
        setCurrent(best);
    };

    let place = { page: 1, offset: 0 };
    // while the pages change size, scroll events say nothing about where the reader is
    let anchoring = false;
    /** The page at the top of the view, and how far down it the view starts. */
    const placeInView = () => {
        const top = scroller.getBoundingClientRect().top;
        let lo = 0;
        let hi = pageElements.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >> 1;
            if (pageElements[mid].getBoundingClientRect().bottom <= top)
                lo = mid + 1;
            else hi = mid;
        }
        const r = pageElements[lo].getBoundingClientRect();
        const offset = (top - r.top) / r.height;
        return { page: lo + 1, offset: Math.min(1, Math.max(0, offset)) };
    };
    const scrollToPlace = () => {
        const el = pageElements[place.page - 1];
        if (!el) return;
        const r = el.getBoundingClientRect();
        scroller.scrollTop +=
            r.top -
            scroller.getBoundingClientRect().top +
            place.offset * r.height;
    };

    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    const savePlace = () => {
        clearTimeout(saveTimer);
        saveTimer = undefined;
        if (!doc()) return;
        const places = getSettingValue(PLACES_SETTING, {});
        void setSettingValue(PLACES_SETTING, {
            ...places,
            [path()]: { ...place, zoom: zoom() },
        });
    };
    const saveSoon = () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(savePlace, 1000);
    };
    onCleanup(() => {
        if (saveTimer) savePlace();
    });
    const onScroll = () => {
        if (anchoring || !pageElements.length) return;
        place = placeInView();
        saveSoon();
    };
    // the same place stays at the top when pages are laid out again
    createEffect(
        on([aspect, width, zoom], ([a]) => {
            if (!a) return;
            anchoring = true;
            requestAnimationFrame(() => {
                scrollToPlace();
                anchoring = false;
            });
        }),
    );
    createEffect(on(zoom, saveSoon, { defer: true }));

    const goTo = (page: number) => {
        const n = Math.min(Math.max(1, page), doc()?.numPages ?? 1);
        pageElements[n - 1]?.scrollIntoView({ block: "start" });
    };
    // open where the book was left (older settings kept only the page)
    createEffect(
        on(aspect, (a) => {
            if (!a) return;
            const saved = getSettingValue(PLACES_SETTING, {})[path()];
            const page = getSettingValue(PAGES_SETTING, {})[path()];
            place = saved
                ? { page: saved.page, offset: saved.offset }
                : { page: page ?? 1, offset: 0 };
            if (saved?.zoom) setZoom(saved.zoom);
        }),
    );
    // #endregion

    // #region diagrams
    const scan = (n: number, isVisible: () => boolean) => {
        if (diagrams[n] || !showDiagrams()) return;
        setDiagrams(n, []);
        scanQueue = scanQueue.then(async () => {
            const d = doc();
            if (!d || !isVisible()) {
                // scrolled past before its turn: scan when it shows again
                setDiagrams(n, undefined!);
                return;
            }
            await pagesDrawn();
            if (!isVisible()) {
                setDiagrams(n, undefined!);
                return;
            }
            try {
                const canvas = await renderPage(d, n, PAGE_SIZE);
                const found = await scanPage(imageToGray(canvas, PAGE_SIZE));
                setDiagrams(
                    n,
                    found.map((f, i) => ({
                        page: n,
                        index: i + 1,
                        read: {
                            placement: f.placement,
                            reliable: f.reliable,
                            minConfidence: f.minConfidence,
                        },
                        orientation: scannedPosition(f).orientation,
                        box: {
                            x0: f.corners.x0 / canvas.width,
                            x1: f.corners.x1 / canvas.width,
                            y0: f.corners.y0 / canvas.height,
                            y1: f.corners.y1 / canvas.height,
                        },
                    })),
                );
            } catch (err) {
                log.warn("page scan failed", n, err);
            }
        });
    };
    // #endregion

    const runFind = async (e: Event) => {
        e.preventDefault();
        const d = doc();
        if (!d || !query().trim()) return;
        setSearching(true);
        try {
            setMatches(await findText(d, query()));
        } finally {
            setSearching(false);
        }
    };

    const position = () => {
        const s = selected();
        return s && scannedPosition(s.read, s.turn);
    };
    const open = (route: string) => {
        const p = position();
        if (p) navigate(`${route}?fen=${encodeURIComponent(p.fen)}`);
    };
    // #region notes: a PGN per diagram, the same files "Scan a whole book" saves
    const notesFolder = () =>
        join("Library", "Scanned", collectionName(baseName(path())));
    const [notes, { refetch: refetchNotes }] = createResource(
        path,
        async () => {
            try {
                const files = await listAppData(await notesFolder());
                return new Set(files.map((f) => f.name));
            } catch {
                return new Set<string>(); // no notes yet
            }
        },
    );
    const hasNotes = (d: PageDiagram) =>
        !!notes()?.has(diagramFileName({ ...d, fen: "" }));

    /**
     * The notes being edited beside the book: the diagram's PGN from its file, or a new one
     * from the scanned position, written to the file only once something is added.
     */
    const [notesGame, setNotesGame] = createSignal<{
        file: string;
        pgn: string;
    }>();
    // a signal: previews of the moves a text would add follow the notes' editor
    const [notesApi, setNotesApi] = createSignal<GameManagerApi>();
    // moves start from the side to move: once there are some, it can't change
    const [notesHaveMoves, setNotesHaveMoves] = createSignal(false);
    // the editor re-writes the PGN as it loads it: that is not a change worth saving
    let baseline = "";
    let loading = false;
    let pending: { file: string; pgn: string } | undefined;
    let notesTimer: ReturnType<typeof setTimeout> | undefined;

    const writeNotes = async () => {
        clearTimeout(notesTimer);
        const p = pending;
        pending = undefined;
        if (!p) return;
        try {
            await mkdir(await notesFolder(), {
                baseDir: BaseDirectory.AppLocalData,
                recursive: true,
            });
            await writeDataFile(p.file, p.pgn);
            if (!notes()?.has(baseName(p.file))) refetchNotes();
        } catch (err) {
            log.error("saving notes failed", err);
            makeToast(`Could not save the notes: ${String(err)}`);
        }
    };
    onCleanup(() => void writeNotes());
    const onNotesChange = (pgn: string) => {
        const game = notesGame();
        if (!game) return;
        setNotesHaveMoves(notesStart(pgn).moves);
        const normal = normalPgn(pgn);
        if (loading) baseline = normal;
        if (normal === baseline) return;
        baseline = normal;
        pending = { file: game.file, pgn };
        clearTimeout(notesTimer);
        notesTimer = setTimeout(writeNotes, 800);
    };

    createEffect(
        on(selected, async (d) => {
            void writeNotes();
            setNotesGame(undefined);
            setNotesApi(undefined);
            setNotesHaveMoves(false);
            if (!d) return;
            const p = scannedPosition(d.read, d.turn);
            if (!p.legal) return;
            const file = await join(
                await notesFolder(),
                diagramFileName({ ...d, fen: "" }),
            );
            const saved = (await exists(file, {
                baseDir: BaseDirectory.AppLocalData,
            }))
                ? await readDataFile(file)
                : undefined;
            if (selected() !== d) return;
            const start = saved ? notesStart(saved) : undefined;
            // the notes' own start wins over the guess from the text
            if (start?.turn && start.turn !== d.turn) {
                setSelected({ ...d, turn: start.turn });
                return;
            }
            setNotesHaveMoves(!!start?.moves);
            const pgn = saved
                ? withOrientation(saved, d.orientation)
                : diagramPgn(NameWithoutExtension(baseName(path())), {
                      ...d,
                      fen: p.fen,
                  });
            baseline = normalPgn(pgn);
            loading = true;
            setNotesGame({ file, pgn });
            setTimeout(() => (loading = false), 500);
        }),
    );

    /** Whose move it is in the diagram; saved notes without moves start again from it (F.22). */
    const changeTurn = async (turn: Color) => {
        const d = selected();
        if (!d) return;
        const game = notesGame();
        const p = scannedPosition(d.read, turn);
        if (game && hasNotes(d) && p.legal) {
            await writeNotes();
            const restarted = restartedNotes(
                await readDataFile(game.file),
                p.fen,
                d.orientation,
            );
            if (!restarted) return;
            await writeDataFile(game.file, restarted);
        }
        if (selected() === d) setSelected({ ...d, turn });
    };

    /** Analysis of the notes once there are any, else of the position. */
    const analyze = async () => {
        const game = notesGame();
        await writeNotes();
        const d = selected();
        if (game && d && hasNotes(d)) {
            navigate(`/analysis?path=${encodeURIComponent(game.file)}`);
        } else open("/analysis");
    };

    // the last text selected on the pages: clicking a button must not lose it
    const [quote, setQuote] = createSignal<{ text: string; page: number }>();
    const onSelection = () => {
        const s = document.getSelection();
        const text = s?.toString().trim();
        const node = s?.anchorNode;
        if (!text || !node || !scroller.contains(node)) return;
        const pageEl = (
            node instanceof Element ? node : node.parentElement
        )?.closest(".reader-page");
        const page = pageElements.indexOf(pageEl as HTMLDivElement) + 1;
        setQuote({ text, page: page || current() });
    };
    onMount(() => {
        document.addEventListener("selectionchange", onSelection);
        onCleanup(() =>
            document.removeEventListener("selectionchange", onSelection),
        );
    });
    // #region chess in the text: whose move, and the moves that follow a diagram
    const pageTexts = new Map<number, Promise<TextItem[]>>();
    const textOf = (page: number) => {
        const d = doc();
        if (!d) return Promise.resolve([]);
        if (!pageTexts.has(page))
            pageTexts.set(
                page,
                pageTextItems(d, page).catch(() => [] as TextItem[]),
            );
        return pageTexts.get(page)!;
    };
    /** Opens a diagram, its side to move from the caption ("White to play") if it says. */
    const pickDiagram = async (d: PageDiagram) => {
        const near = textNearDiagram(await textOf(d.page), d.box);
        // what the book says beside the diagram is sure; the text after it or the board's
        // orientation is a guess, which the game before the diagram may correct (F.42)
        const said = turnFromText(near.caption) ?? near.marker;
        const turn = said ?? turnFromText(near.following) ?? d.orientation;
        const picked = { ...d, turn, following: near.following };
        setSelected(picked);
        setGameBeforeLine(undefined);
        // the game before the diagram, from the text before it (F.11)
        const p = scannedPosition(d.read, turn);
        if (!p.legal) return;
        const pages: TextItem[][] = [];
        for (let n = Math.max(1, d.page - PAGES_BEFORE); n < d.page; n++)
            pages.push(await textOf(n));
        const text = textBeforeDiagram(pages, await textOf(d.page), d.box);
        const moves = gameBefore(text, p.fen.split(" ")[0]);
        if (
            moves &&
            selected()?.page === d.page &&
            selected()?.index === d.index
        ) {
            setGameBeforeLine({ page: d.page, index: d.index, moves });
            const after: Color = moves.length % 2 ? "black" : "white";
            if (!said && after !== turn)
                setSelected({ ...picked, turn: after });
        }
    };
    /** The game before the selected diagram, as read from the text, numbered */
    const [gameBeforeLine, setGameBeforeLine] = createSignal<{
        page: number;
        index: number;
        moves: Move[];
    }>();
    const gameBeforeText = () => {
        const line = gameBeforeLine();
        const d = selected();
        const game = notesGame();
        if (!line || !d || line.page !== d.page || line.index !== d.index)
            return undefined;
        // the notes already start with it
        if (game && diagramPly(game.pgn) !== undefined) return undefined;
        return makeSanVariation(Chess.default(), line.moves);
    };
    /** The notes start with the game before the diagram, then go on with their own moves. */
    const keepGameBefore = async () => {
        const line = gameBeforeLine();
        const d = selected();
        const game = notesGame();
        if (!line || !d || !game) return;
        await writeNotes();
        const saved = (await exists(game.file, {
            baseDir: BaseDirectory.AppLocalData,
        }))
            ? await readDataFile(game.file)
            : game.pgn;
        const pgn = withGameBefore(saved, line.moves, d.page);
        if (!pgn) {
            makeToast(
                "The notes' moves don't follow the game before the diagram: delete them first",
            );
            return;
        }
        try {
            await mkdir(await notesFolder(), {
                baseDir: BaseDirectory.AppLocalData,
                recursive: true,
            });
            await writeDataFile(game.file, pgn);
            if (!notes()?.has(baseName(game.file))) refetchNotes();
        } catch (err) {
            log.error("saving notes failed", err);
            makeToast(`Could not save the notes: ${String(err)}`);
            return;
        }
        // reloads the notes, now from the start, on the diagram's move
        setSelected({
            ...d,
            turn: line.moves.length % 2 ? "black" : "white",
        });
    };
    /**
     * What the notes would get from a text, numbered ("4.c3 Nf6 5.d4"): played from the move
     * shown in the notes, or else from the diagram. Follows the notes as they change.
     */
    const preview = (text: string | undefined) =>
        text ? notesApi()?.previewMovesFromText(text) : undefined;
    const followingLine = () => preview(selected()?.following);
    const selectedLine = () => preview(quote()?.text);
    const clearQuote = () => {
        setQuote(undefined);
        document.getSelection()?.removeAllRanges();
    };
    const addFollowing = () =>
        notesApi()?.addMovesFromText(selected()?.following ?? "");
    const addSelectedMoves = () => {
        if (notesApi()?.addMovesFromText(quote()?.text ?? "")) clearQuote();
    };
    // #endregion

    /** The selected text, as a comment on the move shown in the notes. */
    const addQuote = () => {
        const q = quote();
        if (!q || !notesApi()) return;
        notesApi()!.addComment(bookQuote(q.text, q.page));
        clearQuote();
    };
    // #endregion

    const boardConfig = (): Config => {
        const fen = position()?.fen;
        const setup = fen ? parseFen(fen) : undefined;
        return {
            fen: setup?.isOk ? fen : "8/8/8/8/8/8/8/8 w - - 0 1",
            orientation: selected()?.orientation ?? "white",
            viewOnly: true,
            coordinates: false,
        };
    };

    return (
        <div class="reader_view">
            <div class="reader-toolbar">
                <strong class="reader-title">
                    {NameWithoutExtension(baseName(path()))}
                </strong>
                <Show when={doc()}>
                    <Button
                        class="is-small"
                        title="Previous page"
                        onClick={() => goTo(current() - 1)}
                    >
                        ‹
                    </Button>
                    <input
                        class="input is-small page-input"
                        type="number"
                        min="1"
                        max={doc()!.numPages}
                        value={current()}
                        onChange={(e) => goTo(+e.currentTarget.value)}
                    />
                    <span>/ {doc()!.numPages}</span>
                    <Button
                        class="is-small"
                        title="Next page"
                        onClick={() => goTo(current() + 1)}
                    >
                        ›
                    </Button>
                    <Button
                        class="is-small"
                        title="Zoom out"
                        onClick={() =>
                            setZoom((z) => Math.max(MIN_ZOOM, z / 1.25))
                        }
                    >
                        −
                    </Button>
                    <span>{Math.round(zoom() * 100)}%</span>
                    <Button
                        class="is-small"
                        title="Zoom in"
                        onClick={() =>
                            setZoom((z) => Math.min(MAX_ZOOM, z * 1.25))
                        }
                    >
                        +
                    </Button>
                    <label class="checkbox">
                        <input
                            type="checkbox"
                            checked={showDiagrams()}
                            onChange={(e) =>
                                setShowDiagrams(e.currentTarget.checked)
                            }
                        />{" "}
                        Find diagrams
                    </label>
                </Show>
            </div>
            <div class="reader-body" ref={body}>
                <div class="reader-pages" ref={scroller} onScroll={onScroll}>
                    <Show when={loaded.error}>
                        <p class="notification is-danger is-light">
                            Could not open the PDF: {String(loaded.error)}
                        </p>
                    </Show>
                    <Show when={doc() && aspect()}>
                        <For
                            each={Array.from(
                                { length: doc()!.numPages },
                                (_, i) => i + 1,
                            )}
                        >
                            {(n) => (
                                <ReaderPage
                                    ref={(el) => (pageElements[n - 1] = el)}
                                    doc={doc()!}
                                    number={n}
                                    aspect={aspect()!}
                                    width={() => width() * zoom()}
                                    diagrams={() =>
                                        showDiagrams() ? diagrams[n] : undefined
                                    }
                                    onVisible={(ratio, isVisible) => {
                                        onVisibility(n, ratio);
                                        if (ratio > 0) scan(n, isVisible);
                                    }}
                                    hasNotes={hasNotes}
                                    onPick={pickDiagram}
                                />
                            )}
                        </For>
                    </Show>
                </div>
                <div
                    class="reader-divider"
                    title="Drag to resize; double-click for the usual width"
                    onPointerDown={dragDivider}
                    onDblClick={resetDivider}
                />
                <div
                    class="reader-side"
                    style={
                        sideWidth()
                            ? { "flex-basis": `${sideWidth()}px` }
                            : undefined
                    }
                >
                    <form class="field has-addons" onSubmit={runFind}>
                        <div class="control is-expanded">
                            <input
                                class="input is-small"
                                placeholder="Find in the book"
                                value={query()}
                                onInput={(e) => setQuery(e.currentTarget.value)}
                            />
                        </div>
                        <div class="control">
                            <button
                                class={`button is-small ${searching() ? "is-loading" : ""}`}
                                type="submit"
                            >
                                Find
                            </button>
                        </div>
                    </form>
                    <Show when={matches()}>
                        <p class="reader-matches">
                            {matches()!.length === 0 ? "Not found." : "Pages: "}
                            <For each={matches()}>
                                {(page) => (
                                    <a onClick={() => goTo(page)}>{page} </a>
                                )}
                            </For>
                        </p>
                    </Show>

                    <Show
                        when={selected()}
                        fallback={
                            <p class="reader-hint">
                                Diagrams found on the pages are outlined: click
                                one to take notes on it here (moves, variations,
                                comments), saved with the book.
                            </p>
                        }
                    >
                        <div class="reader-notes-header">
                            <strong>
                                Page {selected()!.page}, diagram{" "}
                                {selected()!.index}
                            </strong>
                            <div class="select is-small">
                                <select
                                    title={
                                        notesHaveMoves()
                                            ? "The notes have moves from this side: delete them to change whose move it is"
                                            : "Whose move it is in the diagram"
                                    }
                                    disabled={notesHaveMoves()}
                                    value={selected()!.turn}
                                    onChange={(e) =>
                                        void changeTurn(
                                            e.currentTarget.value as Color,
                                        )
                                    }
                                >
                                    <option value="white">White to move</option>
                                    <option value="black">Black to move</option>
                                </select>
                            </div>
                            <button
                                class="delete"
                                title="Close the notes"
                                onClick={() => setSelected(undefined)}
                            />
                        </div>
                        <For each={position()?.warnings}>
                            {(w) => <p class="reader-warning">{w}</p>}
                        </For>
                        <Show
                            when={notesGame()}
                            keyed
                            fallback={
                                <Show when={!position()?.legal}>
                                    <div class="reader-board">
                                        <Chessboard config={boardConfig} />
                                    </div>
                                </Show>
                            }
                        >
                            {(game) => (
                                <div class="reader-notes">
                                    <GameManager
                                        compact
                                        initalPgn={() => game.pgn}
                                        setPgn={onNotesChange}
                                        editable={() => true}
                                        onReady={(api) => {
                                            setNotesApi(api);
                                            // notes with the game before: on the diagram
                                            const ply = diagramPly(game.pgn);
                                            if (ply !== undefined)
                                                api.showPly(ply);
                                        }}
                                    />
                                </div>
                            )}
                        </Show>
                        <Show when={notesGame() && gameBeforeText()}>
                            <div class="reader-text-moves">
                                <span>
                                    Game before the diagram:{" "}
                                    <strong>{gameBeforeText()}</strong>
                                </span>
                                <Button
                                    class="is-small is-info is-light"
                                    title="Start the notes with these moves, read from the text before the diagram; they lead to its position"
                                    onClick={() => void keepGameBefore()}
                                >
                                    Start the notes with it
                                </Button>
                            </div>
                        </Show>
                        <Show when={notesGame() && followingLine()}>
                            <div class="reader-text-moves">
                                <span>
                                    Text below the diagram:{" "}
                                    <strong>{followingLine()}</strong>
                                </span>
                                <Button
                                    class="is-small is-info is-light"
                                    title="Play these moves in the notes, from the move shown or from the diagram"
                                    onClick={addFollowing}
                                >
                                    Add these moves
                                </Button>
                            </div>
                        </Show>
                        <Show when={notesGame()}>
                            <div class="reader-selection">
                                <Show
                                    when={quote()}
                                    fallback={
                                        <p class="reader-hint">
                                            Select text on a page to add it
                                            here, as moves or as a comment.
                                        </p>
                                    }
                                >
                                    <p class="reader-quote">
                                        Selected (p. {quote()!.page}): “
                                        {quote()!.text}”
                                    </p>
                                    <p class="reader-selection-moves">
                                        As moves:{" "}
                                        {selectedLine() ? (
                                            <strong>{selectedLine()}</strong>
                                        ) : (
                                            <em>
                                                none that fit the move shown
                                            </em>
                                        )}
                                    </p>
                                    <div class="buttons">
                                        <Button
                                            class="is-small is-info"
                                            disabled={!selectedLine()}
                                            title="Play these moves from the move shown in the notes (or from the diagram)"
                                            onClick={addSelectedMoves}
                                        >
                                            Add as moves
                                        </Button>
                                        <Button
                                            class="is-small"
                                            title="The text becomes a comment on the move shown in the notes"
                                            onClick={addQuote}
                                        >
                                            Add as a comment
                                        </Button>
                                        <Button
                                            class="is-small is-text"
                                            onClick={clearQuote}
                                        >
                                            Clear
                                        </Button>
                                    </div>
                                </Show>
                            </div>
                        </Show>
                        <div class="buttons">
                            <Button
                                class="is-small is-primary"
                                disabled={!position()?.legal}
                                onClick={analyze}
                            >
                                Analyze
                            </Button>
                            <Button
                                class="is-small"
                                disabled={!position()?.legal}
                                onClick={() => open("/play")}
                            >
                                Play from here
                            </Button>
                            <Button
                                class="is-small"
                                disabled={!position()?.legal}
                                onClick={() => open("/databases")}
                            >
                                Find in databases
                            </Button>
                            <Button
                                class="is-small"
                                title="Correct the position first"
                                onClick={() => open("/boardeditor")}
                            >
                                Edit
                            </Button>
                        </div>
                    </Show>
                </div>
            </div>
        </div>
    );
};

// the pages out of view that still have a canvas, oldest first
let kept: (() => void)[] = [];
const keep = (drop: () => void) => {
    if (kept.includes(drop)) return;
    kept.push(drop);
    while (kept.length > KEPT_PAGES) kept.shift()!();
};
const forget = (drop: () => void) => {
    kept = kept.filter((d) => d !== drop);
};

/** One page: a placeholder of the right shape, rendered while it is on screen. */
const ReaderPage: Component<{
    ref: (el: HTMLDivElement) => void;
    doc: PdfDocument;
    number: number;
    aspect: number;
    width: Accessor<number>;
    diagrams: Accessor<PageDiagram[] | undefined>;
    onVisible: (ratio: number, isVisible: () => boolean) => void;
    onPick: (d: PageDiagram) => void;
    hasNotes: (d: PageDiagram) => boolean;
}> = (props) => {
    let el!: HTMLDivElement;
    const [visible, setVisible] = createSignal(false);
    let rendering = 0;

    onMount(() => {
        props.ref(el);
        const observer = new IntersectionObserver(
            ([entry]) => {
                setVisible(entry.isIntersecting);
                props.onVisible(
                    entry.isIntersecting ? entry.intersectionRatio : 0,
                    visible,
                );
            },
            {
                root: el.parentElement,
                rootMargin: "300px",
                threshold: [0, 0.25, 0.5, 0.75, 1],
            },
        );
        observer.observe(el);
        onCleanup(() => observer.disconnect());
    });

    // drawn once it has settled in view (sharp on high-density screens), cancelled when it
    // leaves before; a page scrolled away from keeps its canvas among the last KEPT_PAGES
    let drawnWidth = 0;
    const dropCanvas = () => {
        el.querySelector("canvas")?.remove();
        drawnWidth = 0;
    };
    onCleanup(() => forget(dropCanvas));
    createEffect(() => {
        const w = Math.round(props.width() * (window.devicePixelRatio || 1));
        if (!visible()) {
            if (drawnWidth) keep(dropCanvas);
            return;
        }
        forget(dropCanvas);
        if (drawnWidth === w) return;
        const token = ++rendering;
        let drawing: PageRender | undefined;
        // pending from now (scans wait), until drawn or given up, counted once
        let counted = true;
        setPageRenders((n) => n + 1);
        const done = () => {
            if (counted) setPageRenders((n) => n - 1);
            counted = false;
        };
        const timer = setTimeout(() => {
            drawing = renderPageWidth(props.doc, props.number, w);
            drawing.canvas
                .then((canvas) => {
                    if (token !== rendering) return;
                    canvas.classList.add("reader-canvas");
                    el.querySelector("canvas")?.remove();
                    el.prepend(canvas);
                    drawnWidth = w;
                })
                .catch((err) => {
                    if (token === rendering)
                        log.warn("page render failed", props.number, err);
                })
                .finally(done);
        }, SETTLE_MS);
        onCleanup(() => {
            clearTimeout(timer);
            drawing?.cancel();
            done();
        });
    });

    // selectable text over the canvas, sized by --total-scale-factor so zoom needs no redraw
    const [pointsWide] = createResource(
        async () =>
            (await props.doc.getPage(props.number)).getViewport({ scale: 1 })
                .width,
    );
    type PageText = { div: HTMLDivElement; layer?: PdfTextLayer };
    let text: PageText | undefined;
    createEffect(() => {
        if (!visible()) {
            text?.layer?.cancel();
            text?.div.remove();
            text = undefined;
            return;
        }
        if (text) return;
        const div = document.createElement("div");
        div.className = "textLayer";
        el.append(div);
        const shown: PageText = { div };
        text = shown;
        renderTextLayer(props.doc, props.number, div)
            .then((layer) => {
                if (text === shown) shown.layer = layer;
                else layer.cancel();
            })
            .catch((err) => log.warn("text layer failed", props.number, err));
    });

    return (
        <div
            ref={el}
            class="reader-page"
            style={{
                width: `${props.width()}px`,
                height: `${props.width() * props.aspect}px`,
                "--total-scale-factor": `${props.width() / (pointsWide() || props.width())}`,
            }}
        >
            <For each={props.diagrams()}>
                {(d) => (
                    <button
                        class="reader-diagram"
                        classList={{
                            unsure: !d.read.reliable,
                            "has-notes": props.hasNotes(d),
                        }}
                        title="Study this position"
                        style={{
                            left: `${d.box.x0 * 100}%`,
                            top: `${d.box.y0 * 100}%`,
                            width: `${(d.box.x1 - d.box.x0) * 100}%`,
                            height: `${(d.box.y1 - d.box.y0) * 100}%`,
                        }}
                        onClick={() => props.onPick(d)}
                    />
                )}
            </For>
        </div>
    );
};

export default PdfReader;
