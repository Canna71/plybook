import { Component, createSignal, For, onCleanup, Show } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { useNavigate } from "@solidjs/router";
import { join } from "@tauri-apps/api/path";
import { BaseDirectory, mkdir } from "@tauri-apps/plugin-fs";
import { Color } from "chessops";
import { BoardCorners } from "@scoriiu/fenshot";
import anylogger from "anylogger";
import Button from "../components/common/Button";
import { makeErrorToast, makeToast } from "../components/common/Toast";
import { analysisProfile, startEngine } from "../engine/engineprofiles";
import { searchOnce } from "../engine/search";
import {
    collectionName,
    diagramFileName,
    diagramPgn,
} from "../models/scancollection";
import { getSettingValue } from "../models/settings";
import { openPdf, PdfDocument, renderPage } from "../scan/pdf";
import { imageToGray, scanPage, warmUpScanner } from "../scan/recognizer";
import { PAGE_SIZE } from "../scan/pages";
import { ScanRead, scannedPosition } from "../scan/scan";
import { createPuzzle, pickPuzzle } from "../storage/db";
import { createNewDataFile } from "../storage/fs";
import "./BookScanView.scss";
const log = anylogger("bookscan");

// pages are rendered with PAGE_SIZE as their longer side and read at that size, so the
// diagram boxes are in canvas pixels
const THUMB_SIZE = 140;

type Found = {
    page: number;
    index: number;
    read: ScanRead;
    turn: Color;
    orientation: Color;
    thumb: string;
    include: boolean;
};

const positionOf = (f: Found) => scannedPosition(f.read, f.turn);

function thumbnail(canvas: HTMLCanvasElement, c: BoardCorners) {
    const thumb = document.createElement("canvas");
    thumb.width = THUMB_SIZE;
    thumb.height = THUMB_SIZE;
    thumb
        .getContext("2d")!
        .drawImage(
            canvas,
            c.x0,
            c.y0,
            c.x1 - c.x0,
            c.y1 - c.y0,
            0,
            0,
            THUMB_SIZE,
            THUMB_SIZE,
        );
    return thumb.toDataURL("image/png");
}

/** An image scaled so its longer side is PAGE_SIZE, on a canvas. */
async function imageCanvas(file: Blob) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(
        1,
        PAGE_SIZE / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas;
}

/**
 * Scan a whole book: every diagram of a PDF (or of page images) becomes a position, saved as a
 * collection in the Library and, solved by the engine, as puzzles.
 */
const BookScanView: Component = () => {
    const navigate = useNavigate();
    const [name, setName] = createSignal("");
    const [pdf, setPdf] = createSignal<PdfDocument>();
    const [images, setImages] = createSignal<File[]>([]);
    const [from, setFrom] = createSignal(1);
    const [to, setTo] = createSignal(1);
    const [found, setFound] = createStore<Found[]>([]);
    const [progress, setProgress] = createSignal<string>();
    const [scanning, setScanning] = createSignal(false);
    const [solve, setSolve] = createSignal(true);
    const [saving, setSaving] = createSignal(false);
    const [savedFolder, setSavedFolder] = createSignal<string>();
    let stopRequested = false;

    warmUpScanner();
    const closePdf = () => void pdf()?.loadingTask.destroy();
    onCleanup(() => {
        stopRequested = true;
        closePdf();
    });

    const pageCount = () => pdf()?.numPages ?? images().length;

    const onFiles = async (e: Event) => {
        const files = [...((e.currentTarget as HTMLInputElement).files ?? [])];
        if (!files.length) return;
        setFound([]);
        setSavedFolder(undefined);
        closePdf();
        setPdf(undefined);
        setImages([]);
        setName(collectionName(files[0].name));
        try {
            if (
                files[0].type === "application/pdf" ||
                /\.pdf$/i.test(files[0].name)
            ) {
                const doc = await openPdf(files[0]);
                setPdf(doc);
                setFrom(1);
                setTo(doc.numPages);
            } else {
                setImages(files);
                setFrom(1);
                setTo(files.length);
            }
        } catch (err) {
            makeErrorToast(`Could not open the file: ${String(err)}`);
        }
    };

    const scan = async () => {
        setScanning(true);
        stopRequested = false;
        setFound([]);
        setSavedFolder(undefined);
        try {
            const last = Math.min(to(), pageCount());
            for (let page = Math.max(1, from()); page <= last; page++) {
                if (stopRequested) break;
                setProgress(
                    `Page ${page} of ${last} · ${found.length} diagrams so far`,
                );
                const doc = pdf();
                const canvas = doc
                    ? await renderPage(doc, page, PAGE_SIZE)
                    : await imageCanvas(images()[page - 1]);
                const diagrams = await scanPage(imageToGray(canvas, PAGE_SIZE));
                diagrams.forEach((d, i) => {
                    const read = {
                        placement: d.placement,
                        reliable: d.reliable,
                        minConfidence: d.minConfidence,
                    };
                    const position = scannedPosition(read);
                    setFound(found.length, {
                        page,
                        index: i + 1,
                        read,
                        turn: position.orientation,
                        orientation: position.orientation,
                        thumb: thumbnail(canvas, d.corners),
                        include: position.legal && d.reliable,
                    });
                });
            }
            setProgress(
                `${found.length} diagrams found${stopRequested ? " (stopped)" : ""}`,
            );
        } catch (err) {
            log.error("scan failed", err);
            makeErrorToast(String(err));
        } finally {
            setScanning(false);
        }
    };

    const included = () =>
        found.filter((f) => f.include && positionOf(f).legal);

    const save = async () => {
        setSaving(true);
        const book = name().trim() || "Scanned book";
        let engine: Awaited<ReturnType<typeof startEngine>> | undefined;
        try {
            const folder = await join(
                "Library",
                "Scanned",
                collectionName(book),
            );
            await mkdir(folder, {
                baseDir: BaseDirectory.AppLocalData,
                recursive: true,
            });
            const profile = solve() ? analysisProfile() : undefined;
            if (solve() && !profile) {
                makeToast(
                    "No full-strength engine: saving the positions unsolved",
                );
            }
            engine = profile ? await startEngine(profile) : undefined;
            const list = included();
            let puzzles = 0;
            for (const [i, f] of list.entries()) {
                setProgress(`Saving ${i + 1} of ${list.length}…`);
                const fen = positionOf(f).fen;
                const best = engine
                    ? (
                          await searchOnce(engine, fen, {
                              depth: getSettingValue("engine.review.depth", 18),
                              movetime: getSettingValue(
                                  "engine.review.movetime",
                                  1000,
                              ),
                              multipv: 1,
                          })
                      ).bestmove
                    : undefined;
                const diagram = {
                    page: f.page,
                    index: f.index,
                    fen,
                    solution: best ? [best] : undefined,
                };
                const path = await createNewDataFile(
                    folder,
                    diagramFileName(diagram),
                    diagramPgn(book, diagram),
                );
                if (best) {
                    await createPuzzle(path, 300);
                    puzzles++;
                }
            }
            setSavedFolder(folder);
            setProgress(
                `Saved ${list.length} positions in Library/Scanned/${collectionName(book)}` +
                    (puzzles ? `, ${puzzles} as puzzles` : ""),
            );
        } catch (err) {
            log.error("save failed", err);
            makeErrorToast(String(err));
        } finally {
            engine?.quit();
            setSaving(false);
        }
    };

    const train = async () => {
        const puzzle = await pickPuzzle(savedFolder());
        if (puzzle) {
            navigate(`/puzzle?path=${encodeURIComponent(puzzle.file_path)}`);
        } else {
            makeToast("No puzzles in this collection");
        }
    };

    return (
        <div class="book-scan_view">
            <h1 class="title is-5">Scan a book</h1>
            <p class="block">
                Choose a PDF (or page images): every chess diagram is read and
                saved as a position in your Library; solved by the engine, they
                become puzzles. Everything is read on this computer.
            </p>
            <div class="field is-grouped is-grouped-multiline">
                <div class="control">
                    <div class="file is-small">
                        <label class="file-label">
                            <input
                                class="file-input"
                                type="file"
                                accept="application/pdf,image/*"
                                multiple
                                onChange={onFiles}
                            />
                            <span class="file-cta">
                                <span class="file-label">
                                    Choose a PDF or images…
                                </span>
                            </span>
                        </label>
                    </div>
                </div>
                <Show when={pageCount() > 0}>
                    <div class="control">
                        Pages{" "}
                        <input
                            class="input is-small page"
                            type="number"
                            min="1"
                            max={pageCount()}
                            value={from()}
                            onInput={(e) => setFrom(+e.currentTarget.value)}
                        />{" "}
                        to{" "}
                        <input
                            class="input is-small page"
                            type="number"
                            min="1"
                            max={pageCount()}
                            value={to()}
                            onInput={(e) => setTo(+e.currentTarget.value)}
                        />{" "}
                        of {pageCount()}
                    </div>
                    <div class="control">
                        <Show
                            when={!scanning()}
                            fallback={
                                <Button
                                    class="is-small"
                                    onClick={() => (stopRequested = true)}
                                >
                                    Stop
                                </Button>
                            }
                        >
                            <Button class="is-small is-primary" onClick={scan}>
                                Scan
                            </Button>
                        </Show>
                    </div>
                </Show>
            </div>
            <Show when={progress()}>
                <p class="block">{progress()}</p>
            </Show>

            <Show when={found.length > 0 && !scanning()}>
                <div class="field is-grouped is-grouped-multiline save-bar">
                    <div class="control">
                        <input
                            class="input is-small"
                            value={name()}
                            onInput={(e) => setName(e.currentTarget.value)}
                            title="Collection name (folder in Library/Scanned)"
                        />
                    </div>
                    <label class="checkbox control">
                        <input
                            type="checkbox"
                            checked={solve()}
                            onChange={(e) => setSolve(e.currentTarget.checked)}
                        />{" "}
                        Solve with the engine (makes them puzzles)
                    </label>
                    <div class="control">
                        <Button
                            class={`is-small is-primary ${saving() ? "is-loading" : ""}`}
                            disabled={included().length === 0}
                            onClick={save}
                        >
                            Save {included().length} positions
                        </Button>
                    </div>
                    <Show when={savedFolder()}>
                        <div class="control">
                            <Button
                                class="is-small"
                                onClick={() =>
                                    navigate(
                                        `/library?path=${encodeURIComponent(savedFolder()!)}`,
                                    )
                                }
                            >
                                Open the collection
                            </Button>
                        </div>
                        <div class="control">
                            <Button class="is-small" onClick={train}>
                                Train these puzzles
                            </Button>
                        </div>
                    </Show>
                </div>
            </Show>

            <div class="diagrams">
                <For each={found}>
                    {(f, i) => {
                        const position = () => positionOf(f);
                        return (
                            <div
                                class="diagram box"
                                classList={{ excluded: !f.include }}
                            >
                                <img src={f.thumb} alt={`Page ${f.page}`} />
                                <div class="diagram-info">
                                    <label class="checkbox">
                                        <input
                                            type="checkbox"
                                            checked={f.include}
                                            disabled={!position().legal}
                                            onChange={(e) =>
                                                setFound(
                                                    i(),
                                                    "include",
                                                    e.currentTarget.checked,
                                                )
                                            }
                                        />{" "}
                                        Page {f.page}
                                        {f.index > 1 ? ` · ${f.index}` : ""}
                                    </label>
                                    <div class="select is-small">
                                        <select
                                            value={f.turn}
                                            onChange={(e) =>
                                                setFound(
                                                    produce((all) => {
                                                        all[i()].turn = e
                                                            .currentTarget
                                                            .value as Color;
                                                    }),
                                                )
                                            }
                                        >
                                            <option value="white">
                                                White to move
                                            </option>
                                            <option value="black">
                                                Black to move
                                            </option>
                                        </select>
                                    </div>
                                    <For each={position().warnings}>
                                        {(w) => <p class="warning">{w}</p>}
                                    </For>
                                    <Button
                                        class="is-small"
                                        onClick={() =>
                                            navigate(
                                                `/analysis?fen=${encodeURIComponent(position().fen)}`,
                                            )
                                        }
                                    >
                                        Analyze
                                    </Button>
                                </div>
                            </div>
                        );
                    }}
                </For>
            </div>
        </div>
    );
};

export default BookScanView;
