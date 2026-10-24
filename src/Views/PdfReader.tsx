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
import { Color } from "chessops";
import { parseFen } from "chessops/fen";
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
    renderPage,
    renderPageWidth,
} from "../scan/pdf";
import { imageToGray, scanPage, warmUpScanner } from "../scan/recognizer";
import { ScanRead, scannedPosition } from "../scan/scan";
import { baseName, NameWithoutExtension, readDataBytes } from "../storage/fs";
import "./PdfReader.scss";
const log = anylogger("reader");

const PAGES_SETTING = "reader.pages";
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

/** A diagram on a page, its box in fractions of the page (0–1). */
type PageDiagram = {
    read: ScanRead;
    box: { x0: number; y0: number; x1: number; y1: number };
    orientation: Color;
};

// one page scan at a time: fast scrolling queues pages, and pages scrolled past are skipped
let scanQueue: Promise<unknown> = Promise.resolve();

/**
 * Reads a PDF from the Library: pages render as they scroll into view; the diagrams on each
 * page are found in the background and can be clicked to study the position.
 */
const PdfReader: Component = () => {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const path = () => (typeof params.path === "string" ? params.path : "");

    const [doc] = createResource(path, async (p) =>
        openPdf(new Blob([await readDataBytes(p)])),
    );
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
        PageDiagram & { turn: Color }
    >();
    const [query, setQuery] = createSignal("");
    const [matches, setMatches] = createSignal<number[]>();
    const [searching, setSearching] = createSignal(false);

    let scroller!: HTMLDivElement;
    const pageElements: HTMLDivElement[] = [];

    onMount(() => {
        warmUpScanner();
        const resize = new ResizeObserver(() =>
            setWidth(scroller.clientWidth - 32),
        );
        resize.observe(scroller);
        onCleanup(() => resize.disconnect());
    });

    // #region page position: remembered per book
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
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    createEffect(
        on(current, (page) => {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(() => {
                const pages = getSettingValue<Record<string, number>>(
                    PAGES_SETTING,
                    {},
                );
                void setSettingValue(PAGES_SETTING, {
                    ...pages,
                    [path()]: page,
                });
            }, 1000);
        }),
    );
    const goTo = (page: number) => {
        const n = Math.min(Math.max(1, page), doc()?.numPages ?? 1);
        pageElements[n - 1]?.scrollIntoView({ block: "start" });
    };
    // open where the book was left
    createEffect(
        on(aspect, (a) => {
            if (!a) return;
            const saved = getSettingValue<Record<string, number>>(
                PAGES_SETTING,
                {},
            )?.[path()];
            if (saved && saved > 1) setTimeout(() => goTo(saved), 0);
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
            try {
                const canvas = await renderPage(d, n, PAGE_SIZE);
                const found = await scanPage(imageToGray(canvas, PAGE_SIZE));
                setDiagrams(
                    n,
                    found.map((f) => ({
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
            <div class="reader-body">
                <div class="reader-pages" ref={scroller}>
                    <Show when={doc.error}>
                        <p class="notification is-danger is-light">
                            Could not open the PDF: {String(doc.error)}
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
                                    onPick={(d) =>
                                        setSelected({
                                            ...d,
                                            turn: d.orientation,
                                        })
                                    }
                                />
                            )}
                        </For>
                    </Show>
                </div>
                <div class="reader-side">
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
                                one to study the position.
                            </p>
                        }
                    >
                        <div class="reader-board">
                            <Chessboard config={boardConfig} />
                        </div>
                        <div class="select is-small">
                            <select
                                value={selected()!.turn}
                                onChange={(e) =>
                                    setSelected({
                                        ...selected()!,
                                        turn: e.currentTarget.value as Color,
                                    })
                                }
                            >
                                <option value="white">White to move</option>
                                <option value="black">Black to move</option>
                            </select>
                        </div>
                        <For each={position()?.warnings}>
                            {(w) => <p class="reader-warning">{w}</p>}
                        </For>
                        <div class="buttons">
                            <Button
                                class="is-small is-primary"
                                disabled={!position()?.legal}
                                onClick={() => open("/analysis")}
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

    // render while visible (sharp on high-density screens); drop the canvas when far away
    createEffect(() => {
        const w = props.width();
        if (!visible()) {
            el.querySelector("canvas")?.remove();
            return;
        }
        const token = ++rendering;
        renderPageWidth(
            props.doc,
            props.number,
            Math.round(w * (window.devicePixelRatio || 1)),
        )
            .then((canvas) => {
                if (token !== rendering) return;
                canvas.classList.add("reader-canvas");
                el.querySelector("canvas")?.remove();
                el.prepend(canvas);
            })
            .catch((err) => log.warn("page render failed", props.number, err));
    });

    return (
        <div
            ref={el}
            class="reader-page"
            style={{
                width: `${props.width()}px`,
                height: `${props.width() * props.aspect}px`,
            }}
        >
            <For each={props.diagrams()}>
                {(d) => (
                    <button
                        class="reader-diagram"
                        classList={{ unsure: !d.read.reliable }}
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
