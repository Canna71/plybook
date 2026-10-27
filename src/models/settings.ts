import {
    ensureConfigFileExists,
    readConfigFileAsJson,
    writeConfigFile,
} from "../storage/fs";
import { get, toMerged } from "es-toolkit/compat";
import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
import type { OnlineAccount } from "../online/onlinegames";
import type { NewGame } from "../online/autosync";
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
        /** The engine to play against */
        lastUsed?: string;
        /** The engine for analysis, review and training; "" picks the first full-strength one */
        analysisProfile?: string;
        /** Maia-style profile for human-move hints: "" first one, "off" none */
        human?: string;
        /** Engine threads for analysis, review and play */
        threads?: number;
        analysis: {
            depth?: number;
            /** Milliseconds per position */
            movetime?: number;
            multipv?: number;
            showArrows?: boolean;
        };
        playing: {
            depth?: number;
            /** Milliseconds per move, without clocks */
            movetime?: number;
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
        /** Sync the accounts a little after start and review the new games */
        autoSync?: boolean;
        /** Games synced and reviewed lately, newest first (Today) */
        newGames?: NewGame[];
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
    updates?: {
        /** Look for a new version a little after start (built apps only) */
        check?: boolean;
    };
    /** The model that rewords explanations (P2.4b); the provider and key are in the keychain */
    explain?: {
        anthropicModel?: string;
        /** Ollama, LM Studio or a hosted OpenAI-compatible service: its model name */
        openaiModel?: string;
    };
    reader?: {
        /** Where each PDF was left, by Library path (written as a whole: paths have dots) */
        places?: Record<string, ReaderPlace>;
        /** The page each PDF was left at, before `places`; still read for older books */
        pages?: Record<string, number>;
    };
    library?: {
        /** The Library browser's order: by name, or modified (newest first) */
        sort?: "name" | "modified";
    };
    tutor?: {
        /** Play against the tutor instead of the plain engine (Play screen) */
        on?: boolean;
        /** Your rating, which the tutor plays and coaches at */
        elo?: number;
        /** The level follows your results: up after a win, down after a lost game of mistakes */
        auto?: boolean;
        /**
         * Where the automatic level came from: the default, the puzzle rating (followed until
         * a game), or games (from then on only games move it)
         */
        levelFrom?: "default" | "puzzles" | "games";
        /** "quiet", "normal" or "chatty": how readily it asks about your moves */
        chattiness?: string;
        /** "Take it back?" after a mistake */
        takebacks?: boolean;
    };
    layout: {
        columnsTemplate?: string;
        /** The sidebar shows icons only */
        sidebarCollapsed?: boolean;
        playing: {
            columnsTemplate?: string;
        };
        /** Board, divider and panel of the chess screens; the board takes the rest */
        workspace?: {
            columns?: string;
        };
        /** The analysis panel's sections, open or folded, by id */
        panel?: Record<string, boolean>;
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
        analysisProfile: "",
        human: "",
        threads: 1,
        analysis: {
            depth: 30,
            movetime: 10000,
            multipv: 3,
            showArrows: false,
        },
        playing: {
            depth: 30,
            movetime: 10000,
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
        autoSync: true,
        newGames: [],
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
    updates: {
        check: true,
    },
    explain: {
        anthropicModel: "claude-opus-5-5",
        openaiModel: "",
    },
    reader: {
        places: {},
        pages: {},
    },
    library: {
        sort: "name",
    },
    tutor: {
        on: false,
        elo: 1200,
        auto: true,
        levelFrom: "default",
        chattiness: "normal",
        takebacks: true,
    },
    layout: {
        columnsTemplate: "200px 5px 1fr",
        sidebarCollapsed: false,
        playing: {
            columnsTemplate: "400px 5px 1fr",
        },
        workspace: {
            columns: "1fr 5px 440px",
        },
        panel: {},
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

// Settings are read and written by dotted path ("engine.playing.elo"). The paths and their
// value types come from AppSettings, so a mistyped key or a wrong value fails typecheck.
// A Record (keyed by user data, such as Library paths) is a leaf: written as a whole.

type Leaf = string | number | boolean | unknown[];
/** A record keyed by any string, rather than an object with known keys */
type IsRecord<T> = string extends keyof T ? true : false;

/** Every dotted path into AppSettings, objects as well as their fields */
export type SettingPath<T = AppSettings> = {
    [K in keyof T & string]-?: NonNullable<T[K]> extends Leaf
        ? K
        : IsRecord<NonNullable<T[K]>> extends true
          ? K
          : K | `${K}.${SettingPath<NonNullable<T[K]>>}`;
}[keyof T & string];

/** The value at a path; undefined when a step on the way is optional and unset */
export type SettingValue<
    P extends string,
    T = AppSettings,
> = P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
        ? SettingValue<Rest, NonNullable<T[K]>>
        : never
    : P extends keyof T
      ? T[P]
      : never;

/** The value at `path`, else `fallback` (the defaults in DEFAULT come first) */
export function getSettingValue<P extends SettingPath>(
    path: P,
    fallback: NonNullable<SettingValue<P>>,
): NonNullable<SettingValue<P>>;
export function getSettingValue<P extends SettingPath>(
    path: P,
): SettingValue<P> | undefined;
export function getSettingValue(path: string, fallback?: unknown) {
    return get(settings, path, fallback);
}

export async function setSettingValue<P extends SettingPath>(
    path: P,
    value: SettingValue<P>,
) {
    const args = [...path.split("."), value];
    (setSettings as Function)(...args);
    await saveSettings();
}

(window as any).setSettingValue = setSettingValue;
