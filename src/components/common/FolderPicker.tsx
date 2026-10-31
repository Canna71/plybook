// Choose a Library folder (F.3): where a pasted or new game is saved, and where "Move to…" puts
// a file. Opened with pickFolder(), which resolves to the folder or to undefined; the host is
// mounted once, in Layout. ↑ ↓ choose, Enter confirms, Esc cancels.

import { Component, createEffect, createSignal, For, on, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { sep } from "@tauri-apps/api/path";
import { IconFolder } from "@tabler/icons-solidjs";
import { listFolders } from "../../storage/library";
import { folderDepth } from "../../models/library";
import { makeErrorToast } from "./Toast";
import "./FolderPicker.scss";

export type PickFolderOptions = {
    title: string;
    /** The confirm button: "Save", "Move" */
    action: string;
    /** Chosen at first; listed even if it does not exist yet (Save creates it) */
    initial?: string;
    /** The folders that may be chosen, of all the Library's */
    filter?: (folders: string[]) => string[];
};

type Request = PickFolderOptions & { resolve: (f?: string) => void };

const [request, setRequest] = createSignal<Request>();

/** Asks for a Library folder; undefined when cancelled */
export const pickFolder = (options: PickFolderOptions) =>
    new Promise<string | undefined>((resolve) => {
        request()?.resolve(undefined);
        setRequest({ ...options, resolve });
    });

export const FolderPickerHost: Component = () => {
    const [folders, setFolders] = createSignal<string[]>([]);
    const [selected, setSelected] = createSignal(0);
    let list: HTMLUListElement | undefined;

    createEffect(
        on(request, async (r) => {
            if (!r) return;
            let all: string[] = [];
            try {
                all = await listFolders();
            } catch (e) {
                makeErrorToast(`Could not list the Library: ${e}`);
            }
            if (r.initial && !all.includes(r.initial)) {
                all = [...all, r.initial].sort((a, b) =>
                    a.localeCompare(b, undefined, { numeric: true }),
                );
            }
            const shown = r.filter ? r.filter(all) : all;
            setFolders(shown);
            setSelected(Math.max(0, shown.indexOf(r.initial ?? "")));
            list?.focus();
        }),
    );

    const close = (folder?: string) => {
        request()?.resolve(folder);
        setRequest(undefined);
    };

    const onKeyDown = (e: KeyboardEvent) => {
        const n = folders().length;
        if (e.key === "ArrowDown") setSelected((i) => Math.min(n - 1, i + 1));
        else if (e.key === "ArrowUp") setSelected((i) => Math.max(0, i - 1));
        else if (e.key === "Enter" && n) close(folders()[selected()]);
        else if (e.key === "Escape") close();
        else return;
        e.preventDefault();
        e.stopPropagation();
    };

    const label = (path: string) => path.split(sep()).pop() ?? path;

    return (
        <Show when={request()}>
            {(r) => (
                <Portal>
                    <div class="folder-picker-backdrop" onClick={() => close()}>
                        <div
                            class="folder-picker"
                            role="dialog"
                            aria-label={r().title}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <header>{r().title}</header>
                            <ul
                                ref={list}
                                class="folder-picker-list"
                                role="listbox"
                                tabIndex={0}
                                onKeyDown={onKeyDown}
                            >
                                <For each={folders()}>
                                    {(folder, i) => (
                                        <li
                                            role="option"
                                            aria-selected={i() === selected()}
                                            classList={{
                                                selected: i() === selected(),
                                            }}
                                            style={{
                                                "padding-left": `calc(var(--rc-space-3) + ${folderDepth(folder, sep())} * 1.25em)`,
                                            }}
                                            onClick={() => setSelected(i())}
                                            onDblClick={() => close(folder)}
                                            ref={(el) =>
                                                createEffect(() => {
                                                    if (i() === selected())
                                                        el.scrollIntoView({
                                                            block: "nearest",
                                                        });
                                                })
                                            }
                                        >
                                            <IconFolder />
                                            {label(folder)}
                                        </li>
                                    )}
                                </For>
                                <Show when={!folders().length}>
                                    <li class="folder-picker-empty">
                                        No other folder.
                                    </li>
                                </Show>
                            </ul>
                            <footer>
                                <button class="button" onClick={() => close()}>
                                    Cancel
                                </button>
                                <button
                                    class="button is-primary"
                                    disabled={!folders().length}
                                    onClick={() => close(folders()[selected()])}
                                >
                                    {r().action}
                                </button>
                            </footer>
                        </div>
                    </div>
                </Portal>
            )}
        </Show>
    );
};
