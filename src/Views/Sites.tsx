// Chess sites in the app (I.5): Chessable, chess.com, Lichess and the user's bookmarks, each
// opened in the site window (src-tauri/src/sites.rs). What the user copies or downloads there
// reaches the Library (components/shell/useSites.tsx).

import { Component, createSignal, For, Show } from "solid-js";
import { IconExternalLink, IconTrash } from "@tabler/icons-solidjs";
import PageHeader from "../components/shell/PageHeader";
import Button from "../components/common/Button";
import { makeErrorToast } from "../components/common/Toast";
import { getSettingValue, setSettingValue } from "../models/settings";
import { Bookmark, makeBookmark, Site, SITES } from "../models/sites";
import { openSite } from "../storage/sites";
import "./Sites.scss";

const Sites: Component = () => {
    const bookmarks = () => getSettingValue("sites.bookmarks", []) ?? [];
    const [label, setLabel] = createSignal("");
    const [address, setAddress] = createSignal("");

    const open = (url: string) =>
        openSite(url).catch((err) => makeErrorToast(String(err)));

    const add = async () => {
        const made = makeBookmark(label(), address());
        if (typeof made === "string") return makeErrorToast(made);
        await setSettingValue("sites.bookmarks", [...bookmarks(), made]);
        setLabel("");
        setAddress("");
    };
    const remove = (b: Bookmark) =>
        void setSettingValue(
            "sites.bookmarks",
            bookmarks().filter((x) => x.url !== b.url),
        );

    const card = (site: Site | Bookmark, onRemove?: () => void) => (
        <li class="site-card">
            <button class="site-open" onClick={() => open(site.url)}>
                <span class="site-label">{site.label}</span>
                <span class="site-url">{new URL(site.url).hostname}</span>
                <Show when={"note" in site}>
                    <span class="site-note">{(site as Site).note}</span>
                </Show>
            </button>
            <Show when={onRemove}>
                <button
                    class="site-remove"
                    title="Remove this bookmark"
                    onClick={() => onRemove!()}
                >
                    <IconTrash />
                </button>
            </Show>
        </li>
    );

    return (
        <div class="sites_view">
            <PageHeader
                title="Chess sites"
                description="Open a site in a ReChess window and log in as in any browser; the site cannot reach your Library or settings. While the window is open, a game, move list or position you copy is offered for the Library, and a PGN you download there (a site's own export) is saved in Library/Downloads."
            />
            <ul class="site-list">
                <For each={SITES}>{(site) => card(site)}</For>
                <For each={bookmarks()}>{(b) => card(b, () => remove(b))}</For>
            </ul>

            <h3 class="title is-6">Add a site</h3>
            <form
                class="site-add"
                onSubmit={(e) => {
                    e.preventDefault();
                    void add();
                }}
            >
                <input
                    class="input is-small"
                    placeholder="Name (optional)"
                    value={label()}
                    onInput={(e) => setLabel(e.currentTarget.value)}
                />
                <input
                    class="input is-small"
                    placeholder="Address, e.g. chesstempo.com"
                    value={address()}
                    onInput={(e) => setAddress(e.currentTarget.value)}
                />
                <Button class="is-small" type="submit">
                    <IconExternalLink /> Add
                </Button>
            </form>
            <p class="settings-help">
                Some sign-ins (for example "Sign in with Google") do not work in
                an app's window; log in with e-mail and password instead.
            </p>
        </div>
    );
};

export default Sites;
