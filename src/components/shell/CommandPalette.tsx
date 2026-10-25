// The command palette (UX overhaul, step 2): ⌘K / Ctrl+K anywhere, then type to go to a
// screen, run an action or open a Library file. Ranking is in models/commands.ts.

import {
    createEffect,
    createMemo,
    createResource,
    createSignal,
    For,
    on,
    onCleanup,
    onMount,
    Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import { useNavigate } from "@solidjs/router";
import { rankCommands } from "../../models/commands";
import { allNavItems } from "../../models/navigation";
import { getSettingValue, setSettingValue } from "../../models/settings";
import { listAppData } from "../../storage/fs";
import "./CommandPalette.scss";

const [open, setOpen] = createSignal(false);
export const openCommandPalette = () => setOpen(true);

type Entry = {
    label: string;
    keywords?: string;
    /** What it is ("Screen", "Action", a file's folder) */
    hint: string;
    run: () => void;
};

/** Library files (PGN and PDF), walked when the palette opens; at most a few thousand. */
async function libraryFiles(): Promise<{ name: string; path: string }[]> {
    const files: { name: string; path: string }[] = [];
    const walk = async (dir: string, depth: number) => {
        if (depth > 6 || files.length > 3000) return;
        let entries;
        try {
            entries = await listAppData(dir);
        } catch {
            return;
        }
        for (const e of entries) {
            if (e.name.startsWith(".")) continue;
            const path = `${dir}/${e.name}`;
            if (e.isDirectory) await walk(path, depth + 1);
            else if (/\.(pgn|pdf)$/i.test(e.name))
                files.push({ name: e.name, path });
        }
    };
    await walk("Library", 0);
    return files;
}

export const CommandPalette = () => {
    const navigate = useNavigate();
    const [query, setQuery] = createSignal("");
    const [selected, setSelected] = createSignal(0);
    const [files] = createResource(
        () => open() || undefined,
        () => libraryFiles(),
    );
    let input: HTMLInputElement | undefined;

    const go = (route: string) => () => navigate(route);
    const entries = createMemo<Entry[]>(() => [
        ...allNavItems().map((item) => ({
            label: item.label,
            keywords: item.keywords,
            hint: "Screen",
            run: go(item.route),
        })),
        {
            label: "New analysis",
            keywords: "board empty start",
            hint: "Action",
            run: go("/analysis"),
        },
        {
            label: "Capture a position from the screen",
            keywords: "scan screenshot",
            hint: "Action",
            run: go("/scan"),
        },
        {
            label: "Scan a whole book or PDF",
            keywords: "diagrams collection",
            hint: "Action",
            run: go("/scan-book"),
        },
        {
            label: "Import a PGN database",
            keywords: "games search",
            hint: "Action",
            run: go("/databases"),
        },
        {
            label: "Switch between light and dark",
            keywords: "theme appearance dark mode",
            hint: "Action",
            run: () => {
                const dark =
                    document.documentElement.dataset.theme === "dark" ||
                    (!document.documentElement.dataset.theme &&
                        matchMedia("(prefers-color-scheme: dark)").matches);
                void setSettingValue("themes.ui", dark ? "light" : "dark");
            },
        },
        {
            label: "Collapse or expand the sidebar",
            keywords: "icons",
            hint: "Action",
            run: () =>
                void setSettingValue(
                    "layout.sidebarCollapsed",
                    !getSettingValue<boolean>("layout.sidebarCollapsed", false),
                ),
        },
        ...(files() ?? []).map((f) => ({
            label: f.name,
            keywords: f.path,
            hint: f.path.split("/").slice(1, -1).join(" / ") || "Library",
            run: go(
                f.name.toLowerCase().endsWith(".pdf")
                    ? `/reader?path=${encodeURIComponent(f.path)}`
                    : `/game?path=${encodeURIComponent(f.path)}&source=library`,
            ),
        })),
    ]);
    const results = createMemo(() =>
        rankCommands(query(), entries()).slice(0, 50),
    );

    createEffect(on(query, () => setSelected(0)));
    createEffect(
        on(open, (isOpen) => {
            if (!isOpen) return;
            setQuery("");
            setSelected(0);
            queueMicrotask(() => input?.focus());
        }),
    );

    const run = (entry?: Entry) => {
        if (!entry) return;
        setOpen(false);
        entry.run();
    };

    const onKeyDown = (e: KeyboardEvent) => {
        const count = results().length;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setSelected((i) => (count ? (i + 1) % count : 0));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setSelected((i) => (count ? (i - 1 + count) % count : 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            run(results()[selected()]);
        } else if (e.key === "Escape") {
            e.preventDefault();
            setOpen(false);
        }
    };

    // ⌘K / Ctrl+K anywhere, even while typing
    const onGlobalKey = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
            e.preventDefault();
            setOpen((o) => !o);
        }
    };
    onMount(() => {
        document.addEventListener("keydown", onGlobalKey);
        onCleanup(() => document.removeEventListener("keydown", onGlobalKey));
    });

    return (
        <Show when={open()}>
            <Portal>
                <div
                    class="command-palette-backdrop"
                    onClick={() => setOpen(false)}
                >
                    <div
                        class="command-palette"
                        role="dialog"
                        aria-label="Go to"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <input
                            ref={input}
                            class="command-palette-input"
                            placeholder="Go to a screen, a file, or an action…"
                            value={query()}
                            onInput={(e) => setQuery(e.currentTarget.value)}
                            onKeyDown={onKeyDown}
                        />
                        <ul class="command-palette-results" role="listbox">
                            <For each={results()}>
                                {(entry, i) => (
                                    <li
                                        role="option"
                                        aria-selected={i() === selected()}
                                        classList={{
                                            selected: i() === selected(),
                                        }}
                                        onMouseMove={() => setSelected(i())}
                                        onClick={() => run(entry)}
                                        ref={(el) =>
                                            createEffect(() => {
                                                if (i() === selected())
                                                    el.scrollIntoView({
                                                        block: "nearest",
                                                    });
                                            })
                                        }
                                    >
                                        <span class="command-label">
                                            {entry.label}
                                        </span>
                                        <span class="command-hint">
                                            {entry.hint}
                                        </span>
                                    </li>
                                )}
                            </For>
                            <Show when={!results().length}>
                                <li class="command-empty">Nothing matches.</li>
                            </Show>
                        </ul>
                    </div>
                </div>
            </Portal>
        </Show>
    );
};
