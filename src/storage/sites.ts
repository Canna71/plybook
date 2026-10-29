// The site window (I.5, src-tauri/src/sites.rs): open a site, and while it is open, the text the
// user copies.

import { invoke } from "@tauri-apps/api/core";

/** Opens an https page in the site window */
export const openSite = (url: string) => invoke<void>("site_open", { url });

export const siteIsOpen = () => invoke<boolean>("site_is_open");

/** The clipboard's text, only while the site window is open */
export const siteClipboard = () =>
    invoke<string | null>("site_clipboard").then((t) => t ?? undefined);

/** A PGN a site window downloaded, saved in the Library (relative to the app's data) */
export type SiteDownload = { name: string; path: string };
