import { save } from "@tauri-apps/plugin-dialog";
import { ensureConfigFileExists, readConfigFileAsJson, readDataFile, writeConfigFile } from "../storage/fs";
import { get, set } from "es-toolkit/compat";
export interface AppSettings {
    engine: {
        lastUsed: string;
        depth: number;
        elo: number;
        lines: number;
    }
}

let theSettings: AppSettings;

// export async function initSettings() {
//     if(!theSettings) loadSettings();
// }
async function getSettings() {
    if(theSettings) return theSettings;
    await ensureConfigFileExists("settings.json");
    theSettings = await readConfigFileAsJson<AppSettings>("settings.json") || {} as AppSettings;
    return theSettings;
}

export async function saveSettings() {
    await writeConfigFile("settings.json", theSettings);
}

export async function getSettingValue<T>(path: string,defaultValue: T) {
    await getSettings();
    const value = get(theSettings, path, defaultValue);
    return value;
}

export async function setSettingValue<T>(path: string, value: T) {
    const ssttings = await getSettings();
    theSettings = set(theSettings, path, value);
    await saveSettings();
}