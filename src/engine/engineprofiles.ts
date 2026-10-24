import { invoke } from "@tauri-apps/api/core";
import { createResource } from "solid-js";
import { getSettingValue, setSettingValue } from "../models/settings";

// Mirrors EngineProfile in src-tauri/src/engine.rs
export type UciOption = { name: string; value: string };

export type EngineProfile = {
    id: string;
    name: string;
    /** File name in the Engines folder, or an absolute path when `external` */
    path: string;
    /** Picked with the native file dialog; its path cannot be edited */
    external: boolean;
    args: string[];
    options: UciOption[];
    /** UCI_LimitStrength / UCI_Elo apply (Stockfish yes, Lc0/Maia no) */
    limitStrength: boolean;
    /** Search with `go nodes 1` (how Maia is meant to be used) */
    singleNode: boolean;
    /** The executable no longer exists */
    missing: boolean;
};

export const ENGINES_PLACEHOLDER = "{engines}";

const [profiles, { refetch: refetchProfiles, mutate: setProfiles }] =
    createResource(() => invoke<EngineProfile[]>("engine_list"), {
        initialValue: [],
    });

export { profiles, refetchProfiles };

/** The profile selected in the settings, or the first usable one. */
export function activeProfile(): EngineProfile | undefined {
    const all = profiles();
    const wanted = getSettingValue<string>("engine.lastUsed", "");
    return (
        all.find((p) => p.id === wanted && !p.missing) ??
        all.find((p) => !p.missing)
    );
}

export function setActiveProfile(id: string) {
    return setSettingValue("engine.lastUsed", id);
}

export async function saveProfile(profile: EngineProfile) {
    setProfiles(
        await invoke<EngineProfile[]>("engine_save_profile", { profile }),
    );
}

export async function removeProfile(id: string) {
    setProfiles(await invoke<EngineProfile[]>("engine_remove_profile", { id }));
}

/** Opens the native file dialog; resolves to the new profile, or undefined if cancelled. */
export async function addExternalEngine() {
    const profile = await invoke<EngineProfile | null>("engine_add_external");
    await refetchProfiles();
    return profile ?? undefined;
}

export const getEnginesFolder = () => invoke<string>("engine_folder");
export const openEnginesFolder = () => invoke<void>("engine_open_folder");
export const listWeights = () => invoke<string[]>("engine_weights");

export function newProfileId() {
    return `p-${crypto.randomUUID()}`;
}

/** Values of UCI options may refer to the Engines folder as {engines}. */
export function expandEnginesFolder(value: string, enginesFolder: string) {
    return value.split(ENGINES_PLACEHOLDER).join(enginesFolder);
}
