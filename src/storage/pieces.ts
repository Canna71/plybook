// Piece sets the user installs (U.3, src-tauri/src/pieces.rs): imported from a folder of 12
// images, or downloaded on request when their licence does not let the app ship them.

import { invoke } from "@tauri-apps/api/core";

/** The installed sets, by name */
export const listInstalledPieces = () => invoke<string[]>("pieces_list");

/** An installed set's stylesheet */
export const installedPiecesCss = (name: string) =>
    invoke<string>("pieces_css_of", { name });

/** Asks for a folder of 12 piece images and installs it; its name, or undefined */
export const importPieces = async () =>
    (await invoke<string | null>("pieces_import")) ?? undefined;

/** The sets that can be downloaded on request */
export const downloadablePieces = () => invoke<string[]>("pieces_downloadable");

export const downloadPieces = (name: string) =>
    invoke<void>("pieces_download", { name });

export const removePieces = (name: string) =>
    invoke<void>("pieces_remove", { name });
