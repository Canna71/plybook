// The app's sidebar (UX overhaul, step 2): screens grouped by purpose (models/navigation.ts),
// the current one highlighted, a search entry for the command palette, and a toggle that
// collapses everything to icons. (Files are in the Library screen since step 7.)

import { Component, For, JSX, Show } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import {
    IconBooks,
    IconChessKnight,
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

export const sidebarCollapsed = () =>
    !!getSettingValue<boolean>(COLLAPSED, false);

const isMac = navigator.platform.toUpperCase().includes("MAC");

const Sidebar: Component = () => {
    const location = useLocation();
    const collapsed = sidebarCollapsed;
    const active = () => activeNavItem(location.pathname)?.id;

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
