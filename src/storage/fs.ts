import { BaseDirectory, exists, mkdir, readDir, readFile, writeFile } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
// import { path } from "@tauri-apps/api";

const LIBRARY_FOLDER = "Library";
const ENGINES_FOLDER = "Engines";
const THEMES_FOLDER = "Themes";

export async function initStorage() {
    await ensureAppDataFolders();
}

export async function ensureConfigFileExists(subPath: string) {
    const fileExists = await exists(subPath, { baseDir: BaseDirectory.AppConfig });
    if (!fileExists) {
        await writeFile(subPath, new Uint8Array(), { baseDir: BaseDirectory.AppConfig });
    }
}

export async function readDataFile(subPath: string) {
    // return readTextFile(subPath, {
    //     baseDir: BaseDirectory.AppLocalData
    // });
    return readFile(subPath, {
        baseDir: BaseDirectory.AppLocalData
    }).then((data) => new TextDecoder().decode(data));
}

export async function readConfigFileAsJson<T>(subPath: string): Promise<T> {
    const data = await readFile(subPath, {
        baseDir: BaseDirectory.AppConfig
    });
    const json =  new TextDecoder().decode(data);
    try {
        return JSON.parse(json) as T;
    } catch (error) {
        console.error("Error parsing JSON from file:", error);
        return {} as T;
    }
}

export async function writeConfigFile<T>(subPath: string, data: T) {
    return writeFile(subPath, new TextEncoder().encode(JSON.stringify(data)), {
        baseDir: BaseDirectory.AppConfig
    });
}

export async function writeDataFile(subPath: string, data: string) {
    // return writeTextFile(subPath, data, {  
    //     baseDir: BaseDirectory.AppLocalData
    // });
    // HACK: changed tp use TextEncoder to avoid issues with "unexpected invoke body" error
    return writeFile(subPath, new TextEncoder().encode(data), {
        baseDir: BaseDirectory.AppLocalData
    });
}

async function ensureFolderExists(folderPath: string): Promise<void> {
    try {
        const folderExists = await exists(folderPath);

        if (!folderExists) {
            await mkdir(folderPath, { recursive: true });
        } else {
        }
    } catch (error) {
        console.error(`Error ensuring folder exists at ${folderPath}:`, error);
    }
}

export async function ensureAppDataFolders() {
    try {
        const appDataPath = await appDataDir();
        await ensureFolderExists(appDataPath);
        await ensureFolderExists(await join(appDataPath, LIBRARY_FOLDER, "pgn"));
        await ensureFolderExists(await join(appDataPath, ENGINES_FOLDER));
        await ensureFolderExists(await join(appDataPath, THEMES_FOLDER));
    } catch (error) {
        console.error("Error ensuring AppData folders exist:", error);
    }
}

export async function listAppData(path: string) {
    const files = await readDir(path, { baseDir: BaseDirectory.AppLocalData });
    return files;
}

export async function getEngineFolder(name: string) {
    const appDataDirPath = await appDataDir();
    return join(appDataDirPath, ENGINES_FOLDER, name);
}

export async function getAvailableEngines() {
    const enginesPath = await getEngineFolder("");
    return (await listAppData(enginesPath)).map((entry) => entry.name);
}