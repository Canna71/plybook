import { ensureConfigFileExists, readConfigFileAsJson, writeConfigFile } from "../storage/fs";
import { get, toMerged } from "es-toolkit/compat";
import { createStore } from "solid-js/store";
import { createSignal } from "solid-js";
export interface AppSettings {
    themes?: {
        board?: string;
        pieces?: string;
    }
    engine?: {
        lastUsed?: string;
        analysis: {
            depth?: number;
            lines?: number;
        },
        playing: {
            depth?: number;
            elo?: number;
        }
        
    },
    layout: {
        playing: {
            columnsTemplate?: string;
        }
    }
    _timestamp?: number;
}

const DEFAULT : AppSettings = {
    themes: {
        board: "bluish",
        pieces: "merida"
    }, 
    engine: {
        lastUsed: "",
        analysis: {
            depth: 30,
            lines: 3
        },
        playing: {
            depth: 30,
            elo: 1000
        }
    },
    layout: {
        playing: {
            columnsTemplate: "400px 5px 1fr"
        }
    }
}

// TODO: have a look at here https://github.com/solidjs-community/solid-primitives/tree/main/packages/storage#readme

// let theSettings: AppSettings;
const [settings, setSettings] = createStore<AppSettings>({...DEFAULT}); //= [undefined, undefined ];
const [settingsLoaded, setSettingsLoaded] = createSignal(false);
// createStore(undefined as AppSettings | undefined);
// export async function initSettings() {
//     if(!theSettings) loadSettings();
// }
async function loadSettings() {
    if(settingsLoaded()) return settings;
    await ensureConfigFileExists("settings.json");
    const newSettings = await readConfigFileAsJson<AppSettings>("settings.json") || {} as AppSettings;
    
    const mergedSettings = toMerged(DEFAULT, newSettings)// {...DEFAULT, ...newSettings};
    

    setSettings(mergedSettings);
    saveSettings();
    setSettingsLoaded(true);
    return newSettings;
}
loadSettings();

export async function reloadSettings() {
    setSettingsLoaded(false);
    await loadSettings();
};

export async function saveSettings() {

    await writeConfigFile("settings.json", settings);
}

export  function getSettingValue<T>(path: string,defaultValue?: T) {
    // const settings = await loadSettings();
    const value = get(settings, path, defaultValue);
    return value;
}

export async function setSettingValue(path: string , value: any) {

    const args = [...path.split("."), value];
    (setSettings as Function)(...args);
    await saveSettings();
}

(window as any).setSettingValue = setSettingValue;