// Settings (UX overhaul, step 8b): the sections on the left with a search, one section at a
// time on the right. The open section is in the URL (?section=engines), so the command palette
// and other screens can link to it.

import { Component, createSignal, For, Show } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import { IconSearch } from "@tabler/icons-solidjs";
import EngineSettings from "../components/settings/EngineSettings";
import OnlineAccounts from "../components/settings/OnlineAccounts";
import LichessToken from "../components/settings/LichessToken";
import OpeningBooks from "../components/settings/OpeningBooks";
import Backups from "../components/settings/Backups";
import Appearance from "../components/settings/Appearance";
import Updates from "../components/settings/Updates";
import PageHeader from "../components/shell/PageHeader";
import { findSections, sectionById } from "../models/settingsSections";
import "./Settings.scss";

const Settings: Component = () => {
    const [params, setParams] = useSearchParams();
    const [query, setQuery] = createSignal("");
    const found = () => findSections(query());
    const current = () =>
        sectionById(
            typeof params.section === "string" ? params.section : undefined,
        );
    const open = (id: string) => setParams({ section: id }, { replace: true });

    return (
        <div class="settings_view">
            <PageHeader title="Settings" />
            <div class="settings-layout">
                <nav class="settings-nav" aria-label="Settings sections">
                    <div class="control has-icons-left">
                        <input
                            class="input"
                            type="search"
                            placeholder="Find a setting"
                            value={query()}
                            onInput={(e) => {
                                setQuery(e.currentTarget.value);
                                // show the best match while typing
                                const best = found()[0];
                                if (best) open(best.id);
                            }}
                            onKeyDown={(e) =>
                                e.key === "Escape" && setQuery("")
                            }
                        />
                        <span class="icon is-left">
                            <IconSearch />
                        </span>
                    </div>
                    <ul>
                        <For
                            each={found()}
                            fallback={
                                <li class="settings-nav-empty">
                                    No setting matches “{query().trim()}”.
                                </li>
                            }
                        >
                            {(s) => (
                                <li>
                                    <button
                                        classList={{
                                            active: s.id === current().id,
                                        }}
                                        aria-current={
                                            s.id === current().id
                                                ? "page"
                                                : undefined
                                        }
                                        onClick={() => open(s.id)}
                                    >
                                        {s.label}
                                    </button>
                                </li>
                            )}
                        </For>
                    </ul>
                </nav>
                <div class="settings-content">
                    <Show when={current().id === "appearance"}>
                        <Appearance />
                    </Show>
                    <Show when={current().id === "engines"}>
                        <EngineSettings />
                    </Show>
                    <Show when={current().id === "books"}>
                        <OpeningBooks />
                    </Show>
                    <Show when={current().id === "accounts"}>
                        <OnlineAccounts />
                        <LichessToken />
                    </Show>
                    <Show when={current().id === "backups"}>
                        <Backups />
                    </Show>
                    <Show when={current().id === "updates"}>
                        <Updates />
                    </Show>
                </div>
            </div>
        </div>
    );
};

export default Settings;
