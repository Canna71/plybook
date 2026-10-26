// The app's sidebar (UX overhaul, step 2): screens grouped by purpose (models/navigation.ts),
// the current one highlighted, a search entry for the command palette, the Library's files,
// and a toggle that collapses everything to icons.

import { Component, For, JSX, Show } from "solid-js";
import { A, useLocation, useNavigate } from "@solidjs/router";
import {
    IconBooks,
    IconChessKnight,
    IconChevronDown,
    IconChevronRight,
    IconDatabase,
    IconFolders,
    IconHistory,
    IconHome,
    IconLayoutBoard,
    IconLayoutSidebarLeftCollapse,
    IconLayoutSidebarLeftExpand,
    IconPuzzle,
    IconRoute,
    IconScan,
    IconSearch,
    IconSettings,
    IconSwords,
} from "@tabler/icons-solidjs";
import FileBrowser, {
    FileBrowserFile,
} from "../components/sidebar/FileBrowser";
import {
    activeNavItem,
    NAVIGATION,
    NavItem,
    SETTINGS_ITEM,
} from "../models/navigation";
import { getSettingValue, setSettingValue } from "../models/settings";
import { openCommandPalette } from "../components/shell/CommandPalette";
import "./Sidebar.scss";

const ICONS: Record<string, () => JSX.Element> = {
    home: () => <IconHome />,
    analysis: () => <IconChessKnight />,
    library: () => <IconFolders />,
    book: () => <IconBooks />,
    repertoire: () => <IconRoute />,
    puzzle: () => <IconPuzzle />,
    play: () => <IconSwords />,
    history: () => <IconHistory />,
    database: () => <IconDatabase />,
    scan: () => <IconScan />,
    editor: () => <IconLayoutBoard />,
    settings: () => <IconSettings />,
};

const COLLAPSED = "layout.sidebarCollapsed";
const FILES_OPEN = "layout.filesOpen";

export const sidebarCollapsed = () =>
    !!getSettingValue<boolean>(COLLAPSED, false);

const isMac = navigator.platform.toUpperCase().includes("MAC");

const Sidebar: Component = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const collapsed = sidebarCollapsed;
    const filesOpen = () => getSettingValue<boolean>(FILES_OPEN, true);
    const active = () => activeNavItem(location.pathname)?.id;

    const onFileClick = (file: FileBrowserFile) => {
        if (file.isDirectory) {
            navigate(`/library?path=${encodeURIComponent(file.path)}`);
        } else if (file.name.endsWith(".pgn")) {
            navigate(
                `/game?path=${encodeURIComponent(file.path)}&source=library`,
            );
        } else if (file.name.toLowerCase().endsWith(".pdf")) {
            navigate(`/reader?path=${encodeURIComponent(file.path)}`);
        }
    };

    const link = (item: NavItem) => (
        <A
            href={item.route}
            class="nav-item"
            classList={{ "is-active": active() === item.id }}
            title={collapsed() ? item.label : undefined}
        >
            {ICONS[item.icon]?.()}
            <span class="nav-label">{item.label}</span>
        </A>
    );

    return (
        <nav class="app-sidebar" classList={{ collapsed: collapsed() }}>
            <button
                class="nav-item nav-search"
                title={`Go to… (${isMac ? "⌘" : "Ctrl+"}K)`}
                onClick={openCommandPalette}
            >
                <IconSearch />
                <span class="nav-label">Go to…</span>
                <kbd class="nav-label">{isMac ? "⌘K" : "Ctrl K"}</kbd>
            </button>

            <div class="nav-groups">
                <For each={NAVIGATION}>
                    {(group) => (
                        <div class="nav-group">
                            <Show when={group.label}>
                                <div class="nav-group-label">{group.label}</div>
                            </Show>
                            <For each={group.items}>{link}</For>
                        </div>
                    )}
                </For>

                <Show when={!collapsed()}>
                    <div class="nav-group nav-files">
                        <button
                            class="nav-group-label nav-files-toggle"
                            onClick={() =>
                                void setSettingValue(FILES_OPEN, !filesOpen())
                            }
                        >
                            {filesOpen() ? (
                                <IconChevronDown />
                            ) : (
                                <IconChevronRight />
                            )}
                            Files
                        </button>
                        <Show when={filesOpen()}>
                            <FileBrowser
                                onNodeClick={onFileClick}
                                rootFolder={{
                                    path: "Library",
                                    name: "Library",
                                    isDirectory: true,
                                }}
                            />
                        </Show>
                    </div>
                </Show>
            </div>

            <div class="nav-footer">
                {link(SETTINGS_ITEM)}
                <button
                    class="nav-item"
                    title={
                        collapsed()
                            ? "Expand the sidebar"
                            : "Collapse the sidebar"
                    }
                    onClick={() =>
                        void setSettingValue(COLLAPSED, !collapsed())
                    }
                >
                    {collapsed() ? (
                        <IconLayoutSidebarLeftExpand />
                    ) : (
                        <IconLayoutSidebarLeftCollapse />
                    )}
                    <span class="nav-label">Collapse</span>
                </button>
            </div>
        </nav>
    );
};

export default Sidebar;
