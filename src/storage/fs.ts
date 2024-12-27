import { BaseDirectory, exists, mkdir, readDir, readFile, writeFile } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
// import { path } from "@tauri-apps/api";

const LIBRARY_FOLDER = "Library";

export async function initStorage() {
    await ensureAppDataFolders();
}

export async function readDataFile(subPath: string) {
    // return readTextFile(subPath, {
    //     baseDir: BaseDirectory.AppLocalData
    // });
    return readFile(subPath, {
        baseDir: BaseDirectory.AppLocalData
    }).then((data) => new TextDecoder().decode(data));
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
            console.log(`Folder created at: ${folderPath}`);
        } else {
            console.log(`Folder already exists at: ${folderPath}`);
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
    } catch (error) {
        console.error("Error ensuring AppData folders exist:", error);
    }
}

export async function listAppData(path: string) {
    const files = await readDir(path, { baseDir: BaseDirectory.AppLocalData });
    return files;
}

