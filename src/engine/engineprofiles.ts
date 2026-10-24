import { invoke } from "@tauri-apps/api/core";
import { createResource } from "solid-js";
import { getSettingValue, setSettingValue } from "../models/settings";
import { ExecutableUCIInterface } from "./executableuci";
import { UCIEngine } from "./uciengine";

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

/** The profile selected in the settings, or the first one that can run. */
export function activeProfile(): EngineProfile | undefined {
    const all = profiles();
    const wanted = getSettingValue<string>("engine.lastUsed", "");
    return (
        all.find((p) => p.id === wanted && !p.missing) ??
        all.find((p) => !p.missing)
    );
}

export type Executable = { path: string; external: boolean; label: string };

/** The distinct programs the profiles start, to build new profiles from. */
export function knownExecutables(all: EngineProfile[]): Executable[] {
    const seen = new Map<string, Executable>();
    for (const p of all) {
        const key = `${p.external}:${p.path}`;
        if (!seen.has(key) && !p.missing) {
            seen.set(key, {
                path: p.path,
                external: p.external,
                label: p.external ? p.path : `Engines/${p.path}`,
            });
        }
    }
    return [...seen.values()];
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

/** Native dialog for an engine program; resolves to its path, or undefined if cancelled. */
export async function pickExecutable() {
    return (await invoke<string | null>("engine_pick_executable")) ?? undefined;
}

/** Native dialog for network weights anywhere on the machine (several can be picked). */
export const pickWeights = () => invoke<string[]>("engine_pick_weights");

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

/** Starts a profile's engine and applies its UCI options; rejects if it fails to start. */
export async function startEngine(profile: EngineProfile): Promise<UCIEngine> {
    const engine = new UCIEngine(
        new ExecutableUCIInterface(profile.id, profile.name),
    );
    await engine.init();
    const enginesFolder = await getEnginesFolder();
    for (const option of profile.options) {
        engine.setOption(
            option.name,
            expandEnginesFolder(option.value, enginesFolder),
        );
    }
    return engine;
}

/** "off" disables the human-move hints; empty picks the first Maia-style profile. */
export const HUMAN_SETTING = "engine.human";

/** The Maia-style (one node) profile that shows what humans would play, if any. */
export function humanProfile(): EngineProfile | undefined {
    const wanted = getSettingValue<string>(HUMAN_SETTING, "");
    if (wanted === "off") return undefined;
    const candidates = profiles().filter((p) => p.singleNode && !p.missing);
    return candidates.find((p) => p.id === wanted) ?? candidates[0];
}

/** A full-strength profile to judge moves: the selected one unless it is Maia-style. */
export function analysisProfile(): EngineProfile | undefined {
    const active = activeProfile();
    if (active && !active.singleNode) return active;
    return profiles().find((p) => !p.singleNode && !p.missing);
}
