import {
    ensureConfigFileExists,
    readConfigFileAsJson,
    writeConfigFile,
} from "../storage/fs";
import { get, toMerged } from "es-toolkit/compat";
import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
import type { OnlineAccount } from "../online/onlinegames";
import type { RecentFile } from "./today";

/** A place in a PDF: a page, how far down it the view starts (0–1), and the zoom */
export type ReaderPlace = { page: number; offset: number; zoom: number };

export interface AppSettings {
    themes?: {
        board?: string;
        pieces?: string;
        /** Light or dark UI; "system" follows the operating system */
        ui?: "system" | "light" | "dark";
    };
    engine?: {
        lastUsed?: string;
        /** Maia-style profile for human-move hints: "" first one, "off" none */
        human?: string;
        analysis: {
            depth?: number;
            multipv?: number;
            showArrows?: boolean;
        };
        playing: {
            depth?: number;
            elo?: number;
            /** Polyglot book the engine plays from ("" for none) */
            book?: string;
            /** Clocks for games against the engine, "minutes+seconds" ("" for none) */
            timeControl?: string;
        };
        review?: {
            depth?: number;
            movetime?: number;
        };
    };
    online?: {
        accounts: OnlineAccount[];
    };
    puzzles?: {
        lichess?: {
            /** Theme to train; "" for any */
            theme?: string;
        };
    };
    /** Files opened lately, newest first (Today); written as a whole */
    recent?: {
        files?: RecentFile[];
    };
    today?: {
        /** The first-start checklist was dismissed */
        hideSetup?: boolean;
    };
    backup?: {
        /** A backup a day in <AppLocalData>/Backups, the last seven kept */
        auto?: boolean;
    };
    reader?: {
        /** Where each PDF was left, by Library path (written as a whole: paths have dots) */
        places?: Record<string, ReaderPlace>;
        /** The page each PDF was left at, before `places`; still read for older books */
        pages?: Record<string, number>;
    };
    layout: {
        columnsTemplate?: string;
        /** The sidebar shows icons only */
        sidebarCollapsed?: boolean;
        /** The sidebar's Files tree is open */
        filesOpen?: boolean;
        playing: {
            columnsTemplate?: string;
        };
    };
    _timestamp?: number;
}

const DEFAULT: AppSettings = {
    themes: {
        board: "bluish",
        pieces: "merida",
        ui: "system",
    },
    engine: {
        lastUsed: "",
        human: "",
        analysis: {
            depth: 30,
            multipv: 3,
            showArrows: false,
        },
        playing: {
            depth: 30,
            elo: 1000,
            book: "",
            timeControl: "",
        },
        // per position: a 40-move game takes about a minute
        review: {
            depth: 18,
            movetime: 1000,
        },
    },
    online: {
        accounts: [],
    },
    puzzles: {
        lichess: {
            theme: "",
        },
    },
    recent: {
        files: [],
    },
    today: {
        hideSetup: false,
    },
    backup: {
        auto: true,
    },
    reader: {
        places: {},
        pages: {},
    },
    layout: {
        columnsTemplate: "200px 5px 1fr",
        sidebarCollapsed: false,
        filesOpen: true,
        playing: {
            columnsTemplate: "400px 5px 1fr",
        },
    },
};

// let theSettings: AppSettings;
const [settings, setSettings] = createStore<AppSettings>({ ...DEFAULT }); //= [undefined, undefined ];
const [settingsLoaded, setSettingsLoaded] = createSignal(false);
// createStore(undefined as AppSettings | undefined);
// export async function initSettings() {
//     if(!theSettings) loadSettings();
// }
async function loadSettings() {
    if (settingsLoaded()) return settings;
    await ensureConfigFileExists("settings.json", DEFAULT);
    const newSettings =
        (await readConfigFileAsJson<AppSettings>("settings.json")) ||
        ({} as AppSettings);

    const mergedSettings = toMerged(DEFAULT, newSettings); // {...DEFAULT, ...newSettings};

    setSettings(mergedSettings);
    saveSettings();
    setSettingsLoaded(true);
    return newSettings;
}
loadSettings();

export async function reloadSettings() {
    setSettingsLoaded(false);
    await loadSettings();
}

export async function saveSettings() {
    await writeConfigFile("settings.json", settings);
}

export function getSettingValue<T>(path: string, defaultValue?: T) {
    // const settings = await loadSettings();
    const value = get(settings, path, defaultValue);
    return value;
}

export async function setSettingValue(path: string, value: any) {
    const args = [...path.split("."), value];
    (setSettings as Function)(...args);
    await saveSettings();
}

(window as any).setSettingValue = setSettingValue;
