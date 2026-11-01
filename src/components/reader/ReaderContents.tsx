// The PDF reader's Contents (F.38): the book's own outline, or the headings found in its text,
// and the reader's bookmarks; a click goes to the page.

import {
    Accessor,
    Component,
    createResource,
    createSignal,
    For,
    onCleanup,
    Show,
} from "solid-js";
import { IconBookmark, IconListDetails, IconX } from "@tabler/icons-solidjs";
import { TextItem } from "../../models/booktext";
import {
    ContentsEntry,
    entryAt,
    headingsFromText,
} from "../../models/bookcontents";
import { getSettingValue, setSettingValue } from "../../models/settings";
import { bookOutline, PdfDocument } from "../../scan/pdf";
import Button from "../common/Button";
import "./ReaderContents.scss";

const BOOKMARKS_SETTING = "reader.bookmarks";

type Bookmark = { title: string; page: number };

const ReaderContents: Component<{
    doc: Accessor<PdfDocument | undefined>;
    /** The book's Library path: bookmarks are kept by it */
    path: Accessor<string>;
    /** The page in view */
    current: Accessor<number>;
    /** A page's text, as the reader reads it (cached there) */
    textOf: (page: number) => Promise<TextItem[]>;
    goTo: (page: number) => void;
}> = (props) => {
    const [open, setOpen] = createSignal(false);
    // the book's contents, read the first time they are asked for
    const [asked, setAsked] = createSignal(false);
    const [contents] = createResource(
        () => asked() && props.doc(),
        async (doc) => {
            const outline = await bookOutline(doc);
            if (outline.length) return { entries: outline, found: false };
            const pages: TextItem[][] = [];
            for (let n = 1; n <= doc.numPages; n++)
                pages.push(await props.textOf(n));
            return { entries: headingsFromText(pages), found: true };
        },
    );
    const entries = (): ContentsEntry[] => contents()?.entries ?? [];
    const here = () => entryAt(entries(), props.current());

    // read again after each change, and for another book
    const [saved, setSaved] = createSignal(0);
    const bookmarks = (): Bookmark[] => {
        saved();
        return getSettingValue(BOOKMARKS_SETTING, {})[props.path()] ?? [];
    };
    const saveBookmarks = (list: Bookmark[]) => {
        const all = { ...getSettingValue(BOOKMARKS_SETTING, {}) };
        // an empty list, not a deleted key: setting a record merges it into the stored one
        all[props.path()] = list;
        void setSettingValue(BOOKMARKS_SETTING, all).then(() =>
            setSaved(saved() + 1),
        );
    };
    const [name, setName] = createSignal("");
    const addBookmark = (e: Event) => {
        e.preventDefault();
        const page = props.current();
        const title = name().trim() || here()?.title || `Page ${page}`;
        saveBookmarks(
            [
                ...bookmarks().filter((b) => b.page !== page),
                { title, page },
            ].sort((a, b) => a.page - b.page),
        );
        setName("");
    };

    const go = (page: number) => {
        props.goTo(page);
        setOpen(false);
    };

    // closes on Esc or a click elsewhere
    let panel: HTMLDivElement | undefined;
    const onDown = (e: MouseEvent) => {
        if (panel && !panel.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    onCleanup(() => {
        document.removeEventListener("mousedown", onDown);
        document.removeEventListener("keydown", onKey);
    });

    return (
        <div class="reader-contents" ref={panel}>
            <Button
                class="is-small"
                title="Contents and bookmarks"
                onClick={() => {
                    setAsked(true);
                    setOpen(!open());
                }}
            >
                <IconListDetails size={16} /> Contents
            </Button>
            <Show when={open()}>
                <div class="reader-contents-panel">
                    <div class="reader-contents-heading">Bookmarks</div>
                    <For each={bookmarks()}>
                        {(b) => (
                            <div class="reader-contents-row">
                                <button
                                    class="reader-contents-entry"
                                    classList={{
                                        current: b.page === props.current(),
                                    }}
                                    onClick={() => go(b.page)}
                                >
                                    <IconBookmark size={14} />
                                    <span class="entry-title">{b.title}</span>
                                    <span class="entry-page">{b.page}</span>
                                </button>
                                <button
                                    class="reader-contents-remove"
                                    title="Remove this bookmark"
                                    onClick={() =>
                                        saveBookmarks(
                                            bookmarks().filter(
                                                (x) => x.page !== b.page,
                                            ),
                                        )
                                    }
                                >
                                    <IconX size={14} />
                                </button>
                            </div>
                        )}
                    </For>
                    <form class="reader-contents-add" onSubmit={addBookmark}>
                        <input
                            class="input is-small"
                            placeholder={
                                here()?.title ?? `Page ${props.current()}`
                            }
                            value={name()}
                            onInput={(e) => setName(e.currentTarget.value)}
                        />
                        <Button class="is-small" type="submit">
                            Bookmark page {props.current()}
                        </Button>
                    </form>

                    <div class="reader-contents-heading">
                        Contents
                        <Show when={contents()?.found && entries().length}>
                            <span class="heading-note">
                                {" "}
                                · found in the text
                            </span>
                        </Show>
                    </div>
                    <Show
                        when={!contents.loading}
                        fallback={
                            <div class="reader-contents-note">
                                Reading the book's headings…
                            </div>
                        }
                    >
                        <For
                            each={entries()}
                            fallback={
                                <div class="reader-contents-note">
                                    This book has no contents of its own, and no
                                    headings in its text (a scan of images,
                                    say). Bookmark pages to come back to them.
                                </div>
                            }
                        >
                            {(e) => (
                                <button
                                    class={`reader-contents-entry level-${e.level}`}
                                    classList={{ current: e === here() }}
                                    onClick={() => go(e.page)}
                                >
                                    <span class="entry-title">{e.title}</span>
                                    <span class="entry-page">{e.page}</span>
                                </button>
                            )}
                        </For>
                    </Show>
                </div>
            </Show>
        </div>
    );
};

export default ReaderContents;
