import { ensureConfigFileExists, readConfigFileAsJson, writeConfigFile } from "../storage/fs";
import { get } from "es-toolkit/compat";
import { createStore, Part } from "solid-js/store";
import { createSignal } from "solid-js";
export interface AppSettings {
    themes?: {
        board?: string;
        pieces?: string;
    }
    engine?: {
        lastUsed?: string;
        depth?: number;
        elo?: number;
        lines?: number;
    },
    _timestamp?: number;
}

const DEFAULT : AppSettings = {
    themes: {
        board: "bluish",
        pieces: "merida"
    }
}

// let theSettings: AppSettings;
const [settings, setSettings] = createStore<AppSettings>(undefined); //= [undefined, undefined ];
const [settingsLoaded, setSettingsLoaded] = createSignal(false);
// createStore(undefined as AppSettings | undefined);
// export async function initSettings() {
//     if(!theSettings) loadSettings();
// }
async function loadSettings() {
    if(settingsLoaded()) return settings;
    await ensureConfigFileExists("settings.json");
    const newSettings = await readConfigFileAsJson<AppSettings>("settings.json") || {} as AppSettings;
    
    const mergedSettings = {...DEFAULT, ...newSettings};
    

    setSettings(mergedSettings);
    setSettingsLoaded(true);
    return newSettings;
}

export async function reloadSettings() {
    setSettingsLoaded(false);
    await loadSettings();
};

export async function saveSettings() {

    await writeConfigFile("settings.json", settings);
}

export async function getSettingValue<T>(path: string,defaultValue?: T) {
    const settings = await loadSettings();
    const value = get(settings, path, defaultValue);
    return value;
}

export async function setSettingValue(path: string , value: any) {
    await loadSettings();
    setSettings(path as Part<AppSettings, keyof AppSettings>, value);
    await saveSettings();
}

(window as any).setSettingValue = setSettingValue;