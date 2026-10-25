// Books (UX overhaul, step 7b): every PDF in the Library as a book on a shelf, the last read
// first, with the page you left it at and the diagrams scanned from it; then scanned
// collections whose PDF is not in the Library.

import { A, useNavigate } from "@solidjs/router";
import { createMemo, createResource, For, Show } from "solid-js";
import { sep } from "@tauri-apps/api/path";
import { BaseDirectory, mkdir } from "@tauri-apps/plugin-fs";
import { IconBook, IconFileImport, IconScan } from "@tabler/icons-solidjs";
import PageHeader from "../components/shell/PageHeader";
import { makeToast } from "../components/common/Toast";
import { bookshelf } from "../models/bookshelf";
import { getSettingValue, ReaderPlace } from "../models/settings";
import { ago } from "../models/today";
import { createNewDataFile } from "../storage/fs";
import { LIBRARY_ROOT, listAllFiles, listScanned } from "../storage/library";
import { recentFiles } from "../storage/recent";
import "./Books.scss";

const BOOKS_FOLDER = "Books";

const Books = () => {
    const navigate = useNavigate();
    const [pdfs, { refetch }] = createResource(async () =>
        (await listAllFiles()).filter((f) => f.kind === "book"),
    );
    const [scanned] = createResource(listScanned);

    const shelf = createMemo(() =>
        bookshelf(
            pdfs() ?? [],
            sep(),
            getSettingValue<Record<string, ReaderPlace>>("reader.places", {}) ??
                {},
            getSettingValue<Record<string, number>>("reader.pages", {}) ?? {},
            recentFiles(),
            scanned() ?? new Map(),
        ),
    );

    const readerLink = (path: string) =>
        `/reader?path=${encodeURIComponent(path)}`;
    const scannedLink = (collection: string) =>
        `/library?path=${encodeURIComponent(
            [LIBRARY_ROOT, "Scanned", collection].join(sep()),
        )}`;

    // PDFs chosen in the picker go to Library/Books
    const addPdfs = async (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const files = [...(input.files ?? [])];
        input.value = "";
        if (!files.length) return;
        const folder = `${LIBRARY_ROOT}${sep()}${BOOKS_FOLDER}`;
        await mkdir(folder, {
            baseDir: BaseDirectory.AppLocalData,
            recursive: true,
        });
        for (const file of files) {
            await createNewDataFile(
                folder,
                file.name,
                new Uint8Array(await file.arrayBuffer()),
            );
        }
        makeToast(
            files.length === 1
                ? `Added “${files[0].name}” to Library / Books`
                : `Added ${files.length} books to Library / Books`,
        );
        refetch();
    };

    const addButton = (primary: boolean) => (
        <label
            class="button"
            classList={{ "is-primary": primary }}
            title="Copy PDF books into Library / Books"
        >
            <input
                type="file"
                accept=".pdf,application/pdf"
                multiple
                hidden
                onChange={addPdfs}
            />
            <IconFileImport />
            Add PDF…
        </label>
    );

    return (
        <div class="books_view">
            <PageHeader
                title="Books"
                description="The PDF books in your Library. Each opens where you left it; diagrams you scan or annotate are kept with the book."
            >
                <button class="button" onClick={() => navigate("/scan-book")}>
                    <IconScan />
                    Scan a whole book…
                </button>
                {addButton(true)}
            </PageHeader>

            <Show
                when={!pdfs.loading && shelf().books.length === 0}
                fallback={
                    <div class="books-shelf">
                        <For each={shelf().books}>
                            {(book) => (
                                <A
                                    class="book-card"
                                    href={readerLink(book.path)}
                                >
                                    <span class="book-cover">
                                        <IconBook />
                                    </span>
                                    <span class="book-text">
                                        <span class="book-title">
                                            {book.title}
                                        </span>
                                        <Show when={book.folder}>
                                            <span class="book-muted">
                                                {book.folder}
                                            </span>
                                        </Show>
                                        <span class="book-muted">
                                            {book.page
                                                ? `Page ${book.page}`
                                                : "Not started"}
                                            <Show when={book.opened}>
                                                {" · "}
                                                {ago(book.opened!, Date.now())}
                                            </Show>
                                        </span>
                                        <Show when={book.collection}>
                                            <span
                                                class="book-diagrams"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    navigate(
                                                        scannedLink(
                                                            book.collection!,
                                                        ),
                                                    );
                                                }}
                                            >
                                                {book.diagrams} scanned{" "}
                                                {book.diagrams === 1
                                                    ? "diagram"
                                                    : "diagrams"}
                                            </span>
                                        </Show>
                                    </span>
                                </A>
                            )}
                        </For>
                    </div>
                }
            >
                <div class="rc-empty">
                    <strong>No books yet</strong>
                    <p>
                        Add a PDF chess book to read it here, play through its
                        diagrams and keep notes beside each one.
                    </p>
                    <p class="books-empty-action">{addButton(true)}</p>
                </div>
            </Show>

            <Show when={shelf().collections.length}>
                <h2 class="books-section">Scanned without a PDF</h2>
                <ul class="books-collections">
                    <For each={shelf().collections}>
                        {(c) => (
                            <li>
                                <A href={scannedLink(c.name)}>{c.name}</A>
                                <span class="book-muted">
                                    {c.diagrams}{" "}
                                    {c.diagrams === 1 ? "diagram" : "diagrams"}
                                </span>
                            </li>
                        )}
                    </For>
                </ul>
            </Show>
        </div>
    );
};

export default Books;
