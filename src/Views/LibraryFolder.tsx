// The Library as a browser (UX overhaul, step 7a): a folder's folders, games and books with
// their dates, a search across the whole Library, and files added by import or by dropping
// them on the window (copied by Rust, src-tauri/src/library.rs).

import { useNavigate, useSearchParams } from "@solidjs/router";
import {
    batch,
    createEffect,
    createMemo,
    createResource,
    createSignal,
    For,
    on,
    onCleanup,
    onMount,
    Show,
    useContext,
} from "solid-js";
import { sep } from "@tauri-apps/api/path";
import { ask } from "@tauri-apps/plugin-dialog";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import {
    IconBook,
    IconChess,
    IconDots,
    IconFileImport,
    IconFolder,
    IconFolderOpen,
    IconFolderPlus,
    IconPlus,
    IconSearch,
} from "@tabler/icons-solidjs";
import anylogger from "anylogger";
import Button from "../components/common/Button";
import { fileBrowserName } from "../models/osutils";
import {
    createNewDataFile,
    createNewDataFolder,
    deleteDataFileOrFolder,
    getDefaultStudyContent,
    moveDataFile,
    openDataPath,
    renameDataFile,
} from "../storage/fs";
import {
    importDropped,
    LIBRARY_ROOT,
    listAllFiles,
    listFolder,
    withInfo,
} from "../storage/library";
import { forgetRecent, recentFiles } from "../storage/recent";
import {
    displayName,
    folderLabel,
    folderOf,
    formatSize,
    KIND_LABEL,
    LibraryEntry,
    matchesQuery,
    moveTargets,
    renamedName,
    SortKey,
    sortEntries,
} from "../models/library";
import { ago } from "../models/today";
import { getSettingValue, setSettingValue } from "../models/settings";
import { ContentContext } from "../components/common/ContentContext";
import Editable from "../components/common/Editable";
import Menu, { MenuItem } from "../components/common/Menu";
import { pickFolder } from "../components/common/FolderPicker";
import BreadCrumb from "../components/common/BreadCrumb";
import PageHeader from "../components/shell/PageHeader";
import { makeErrorToast, makeToast } from "../components/common/Toast";
import "./LibraryFolder.scss";
const log = anylogger("library");

const SORT_SETTING = "library.sort";
const MAX_RESULTS = 200;

const KIND_ICON = {
    folder: IconFolder,
    games: IconChess,
    book: IconBook,
};

/** Where a Library entry opens: folders here, games in the editor, books in the reader. */
export const openLink = (entry: LibraryEntry) =>
    entry.kind === "folder"
        ? `/library?path=${encodeURIComponent(entry.path)}`
        : entry.kind === "book"
          ? `/reader?path=${encodeURIComponent(entry.path)}`
          : `/game?path=${encodeURIComponent(entry.path)}&source=library`;

const LibraryFolder = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { renaming, setRenaming, refresh } = useContext(ContentContext)!;

    const folder = () =>
        typeof searchParams.path === "string"
            ? searchParams.path
            : LIBRARY_ROOT;
    const isRoot = () => folder() === LIBRARY_ROOT;
    const title = () => folder().split(sep()).pop() ?? LIBRARY_ROOT;

    const [entries, { refetch }] = createResource(folder, listFolder);
    const sort = (): SortKey => getSettingValue(SORT_SETTING, "name");
    const sorted = createMemo(() => sortEntries(entries() ?? [], sort()));

    // search covers the whole Library, listed once a search starts
    const [query, setQuery] = createSignal("");
    // opening a folder (a result's, or the breadcrumb's) ends the search
    createEffect(on(folder, () => setQuery(""), { defer: true }));
    const [allFiles, { refetch: refetchAll }] = createResource(
        () => query().trim() !== "",
        (searching) => (searching ? listAllFiles() : Promise.resolve([])),
    );
    const matches = createMemo(() =>
        (allFiles() ?? [])
            .filter((f) => matchesQuery(f.name, query()))
            .slice(0, MAX_RESULTS),
    );
    // dates and sizes only for what matched
    const [matchInfo] = createResource(matches, withInfo);
    const results = () => sortEntries(matchInfo.latest ?? matches(), sort());
    const searching = () => query().trim() !== "";

    const opened = createMemo(
        () => new Map(recentFiles().map((f) => [f.path, f.at])),
    );

    /** After any change: this listing, the search and the sidebar's tree. */
    const changed = () => {
        refetch();
        if (searching()) refetchAll();
        refresh();
    };

    // #region actions
    const newStudy = async () => {
        const path = await createNewDataFile(
            folder(),
            "Untitled.pgn",
            getDefaultStudyContent(),
        );
        batch(() => {
            changed();
            setRenaming(path);
        });
    };

    const newFolder = async () => {
        const path = await createNewDataFolder(folder(), "New folder");
        batch(() => {
            changed();
            setRenaming(path);
        });
    };

    // files chosen in the picker are read by the webview and written into this folder
    const importFiles = async (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const files = [...(input.files ?? [])];
        input.value = "";
        for (const file of files) {
            await createNewDataFile(
                folder(),
                file.name,
                new Uint8Array(await file.arrayBuffer()),
            );
        }
        if (files.length) {
            makeToast(
                files.length === 1
                    ? `Added ${file(files[0].name)}`
                    : `Added ${files.length} files`,
            );
            changed();
        }
    };
    const file = (name: string) => `“${name}”`;

    const onRenamed = async (entry: LibraryEntry, newName: string) => {
        try {
            const path = await renameDataFile(
                entry.path,
                renamedName(entry, newName),
            );
            if (path !== entry.path) forgetRecent(entry.path);
        } catch (e) {
            makeErrorToast(`Could not rename: ${e}`);
        }
        batch(() => {
            setRenaming(undefined);
            changed();
        });
    };

    const onDelete = async (entry: LibraryEntry) => {
        const yes = await ask(
            entry.kind === "folder"
                ? `Delete the folder ${file(entry.name)} and everything in it?`
                : `Delete ${file(entry.name)}?`,
            { title: "Delete", kind: "warning", okLabel: "Delete" },
        );
        if (!yes) return;
        await deleteDataFileOrFolder(entry.path);
        forgetRecent(entry.path);
        changed();
    };

    const onMove = async (entry: LibraryEntry) => {
        const to = await pickFolder({
            title: `Move ${file(displayName(entry))} to`,
            action: "Move",
            filter: (folders) => moveTargets(entry.path, folders, sep()),
        });
        if (!to) return;
        try {
            await moveDataFile(entry.path, to);
            forgetRecent(entry.path);
            makeToast(`Moved to ${folderLabel(to, sep())}`);
        } catch (e) {
            makeErrorToast(`Could not move: ${e}`);
        }
        changed();
    };

    const showInFinder = (path: string) =>
        openDataPath(path).catch((e) => {
            log.error(e);
            makeErrorToast(String(e));
        });

    const rowMenu = (entry: LibraryEntry): MenuItem[] => [
        { label: "Open", onClick: () => navigate(openLink(entry)) },
        { label: "Rename", onClick: () => setRenaming(entry.path) },
        { label: "Move to…", onClick: () => onMove(entry) },
        ...(entry.kind === "folder"
            ? [
                  {
                      label: `Show in ${fileBrowserName()}`,
                      onClick: () => showInFinder(entry.path),
                  },
              ]
            : []),
        "separator",
        { label: "Delete…", onClick: () => onDelete(entry) },
    ];
    // #endregion

    // #region drop files from the Finder
    const [dropping, setDropping] = createSignal(false);
    onMount(() => {
        let unlisten: (() => void) | undefined;
        let gone = false;
        getCurrentWebview()
            .onDragDropEvent(async (event) => {
                const type = event.payload.type;
                if (type === "enter" || type === "over") setDropping(true);
                else if (type === "leave") setDropping(false);
                else if (type === "drop") {
                    setDropping(false);
                    try {
                        const r = await importDropped(folder());
                        if (r.imported.length)
                            makeToast(
                                r.imported.length === 1
                                    ? `Added ${file(r.imported[0].split(sep()).pop()!)}`
                                    : `Added ${r.imported.length} files`,
                            );
                        if (r.skipped.length)
                            makeToast(
                                `Only PGN and PDF files can be added: skipped ${r.skipped.join(", ")}`,
                            );
                        changed();
                    } catch (e) {
                        makeErrorToast(String(e));
                    }
                }
            })
            .then((fn) => (gone ? fn() : (unlisten = fn)))
            .catch((e) => log.warn("no drag and drop", e));
        onCleanup(() => {
            gone = true;
            unlisten?.();
        });
    });
    // #endregion

    const setSort = (key: SortKey) => void setSettingValue(SORT_SETTING, key);

    const Row = (props: { entry: LibraryEntry; showFolder?: boolean }) => {
        const Icon = KIND_ICON[props.entry.kind];
        const isRenaming = () => renaming() === props.entry.path;
        const lastOpened = () => opened().get(props.entry.path);
        return (
            <tr>
                <td class="library-name">
                    <span class={`library-icon ${props.entry.kind}`}>
                        <Icon />
                    </span>
                    <Show
                        when={!isRenaming()}
                        fallback={
                            <Editable
                                initialValue={displayName(props.entry)}
                                editable={() => true}
                                onSave={(name) => onRenamed(props.entry, name)}
                                focus={true}
                            />
                        }
                    >
                        <a href={openLink(props.entry)}>
                            {displayName(props.entry)}
                            <Show
                                when={
                                    props.showFolder &&
                                    folderOf(props.entry.path, sep())
                                }
                            >
                                <span class="library-where">
                                    {folderOf(props.entry.path, sep())}
                                </span>
                            </Show>
                        </a>
                    </Show>
                </td>
                <td class="library-kind">{KIND_LABEL[props.entry.kind]}</td>
                <td class="library-date">
                    {props.entry.modified
                        ? ago(props.entry.modified, Date.now())
                        : ""}
                </td>
                <td class="library-date">
                    {lastOpened() ? ago(lastOpened()!, Date.now()) : ""}
                </td>
                <td class="library-size">
                    {props.entry.size !== undefined
                        ? formatSize(props.entry.size)
                        : ""}
                </td>
                <td class="library-actions">
                    <Menu
                        items={rowMenu(props.entry)}
                        title="More"
                        iconOnly
                        alignRight
                    >
                        <IconDots />
                    </Menu>
                </td>
            </tr>
        );
    };

    return (
        <div class="library-folder" classList={{ dropping: dropping() }}>
            <PageHeader
                title={isRoot() ? "Library" : title()}
                description={
                    isRoot() ? (
                        "Your games, studies and PDF books. Drop PGN or PDF files here to add them."
                    ) : (
                        <BreadCrumb path={folder} />
                    )
                }
            >
                <div class="control has-icons-left library-search">
                    <input
                        class="input"
                        type="search"
                        placeholder="Search the Library"
                        value={query()}
                        onInput={(e) => setQuery(e.currentTarget.value)}
                        onKeyDown={(e) => e.key === "Escape" && setQuery("")}
                    />
                    <span class="icon is-left">
                        <IconSearch />
                    </span>
                </div>
                <Menu
                    title="New"
                    alignRight
                    items={[
                        {
                            label: "New study",
                            icon: <IconPlus />,
                            onClick: newStudy,
                        },
                        {
                            label: "New folder",
                            icon: <IconFolderPlus />,
                            onClick: newFolder,
                        },
                    ]}
                >
                    <IconPlus />
                    New
                </Menu>
                <label
                    class="button is-primary"
                    title="Copy PGN or PDF files into this folder"
                >
                    <input
                        type="file"
                        accept=".pgn,.pdf,application/pdf"
                        multiple
                        hidden
                        onChange={importFiles}
                    />
                    <IconFileImport />
                    Import…
                </label>
                {/* F.15: the folder itself, on the computer */}
                <Button
                    title={`Open this folder in ${fileBrowserName()}`}
                    onClick={() => showInFinder(folder())}
                >
                    <IconFolderOpen />
                    Show in {fileBrowserName()}
                </Button>
                <Menu
                    title="More"
                    iconOnly
                    alignRight
                    items={[{ label: "Refresh", onClick: changed }]}
                >
                    <IconDots />
                </Menu>
            </PageHeader>

            <div class="library-list">
                <table class="table is-hoverable is-fullwidth">
                    <thead>
                        <tr>
                            <th>
                                <button
                                    class="library-sort"
                                    classList={{ active: sort() === "name" }}
                                    onClick={() => setSort("name")}
                                >
                                    Name
                                </button>
                            </th>
                            <th>Kind</th>
                            <th>
                                <button
                                    class="library-sort"
                                    classList={{
                                        active: sort() === "modified",
                                    }}
                                    onClick={() => setSort("modified")}
                                    title="Newest first"
                                >
                                    Modified
                                </button>
                            </th>
                            <th>Opened</th>
                            <th>Size</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        <Show
                            when={!searching()}
                            fallback={
                                <For
                                    each={results()}
                                    fallback={
                                        <tr>
                                            <td colspan="6" class="rc-empty">
                                                {allFiles.loading
                                                    ? "Searching…"
                                                    : `Nothing in the Library matches “${query().trim()}”.`}
                                            </td>
                                        </tr>
                                    }
                                >
                                    {(entry) => (
                                        <Row entry={entry} showFolder />
                                    )}
                                </For>
                            }
                        >
                            <For
                                each={sorted()}
                                fallback={
                                    <tr>
                                        <td colspan="6" class="rc-empty">
                                            <Show when={!entries.loading}>
                                                <strong>
                                                    This folder is empty
                                                </strong>
                                                Create a study or a folder,
                                                import PGN or PDF files, or drop
                                                them here.
                                            </Show>
                                        </td>
                                    </tr>
                                }
                            >
                                {(entry) => <Row entry={entry} />}
                            </For>
                        </Show>
                    </tbody>
                </table>
            </div>

            <Show when={dropping()}>
                <div class="library-drop">
                    <IconFileImport />
                    Drop PGN or PDF files to add them to “{title()}”
                </div>
            </Show>
        </div>
    );
};

export default LibraryFolder;
