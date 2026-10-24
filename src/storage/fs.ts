import {
    BaseDirectory,
    exists,
    mkdir,
    readDir,
    readFile,
    remove,
    rename,
    writeFile,
} from "@tauri-apps/plugin-fs";
import { appConfigDir, appLocalDataDir, join, sep } from "@tauri-apps/api/path";
import { invoke } from "@tauri-apps/api/core";
import anylogger from "anylogger";
const log = anylogger("fs");

const LIBRARY_FOLDER = "Library";
const HISTORY_FOLDER = "History";
const THEMES_FOLDER = "Themes";

export async function initStorage() {
    await ensureAppDataFolders();
    await ensureConfigFolder();
}

export async function ensureConfigFileExists(subPath: string, value: any) {
    await ensureConfigFolder();
    const fileExists = await exists(subPath, {
        baseDir: BaseDirectory.AppConfig,
    });
    if (!fileExists) {
        await writeConfigFile(subPath, value);
    }
}

export async function readDataFile(subPath: string) {
    // return readTextFile(subPath, {
    //     baseDir: BaseDirectory.AppLocalData
    // });
    return readFile(subPath, {
        baseDir: BaseDirectory.AppLocalData,
    }).then((data) => new TextDecoder().decode(data));
}

export async function readConfigFileAsJson<T>(subPath: string): Promise<T> {
    const data = await readFile(subPath, {
        baseDir: BaseDirectory.AppConfig,
    });
    const json = new TextDecoder().decode(data);
    try {
        return JSON.parse(json) as T;
    } catch (error) {
        log.error("Error parsing JSON from file:", error);
        return {} as T;
    }
}

export async function writeConfigFile<T>(subPath: string, data: T) {
    return writeFile(subPath, new TextEncoder().encode(JSON.stringify(data)), {
        baseDir: BaseDirectory.AppConfig,
    });
}

export async function writeDataFile(subPath: string, data: string) {
    // return writeTextFile(subPath, data, {
    //     baseDir: BaseDirectory.AppLocalData
    // });
    return writeFile(subPath, new TextEncoder().encode(data), {
        baseDir: BaseDirectory.AppLocalData,
    });
}

async function ensureFolderExists(folderPath: string): Promise<void> {
    try {
        const folderExists = await exists(folderPath);

        if (!folderExists) {
            await mkdir(folderPath, { recursive: true });
        }
    } catch (error) {
        log.error(`Error ensuring folder exists at ${folderPath}:`, error);
    }
}

export async function ensureConfigFolder() {
    try {
        const configPath = await appConfigDir();
        await ensureFolderExists(configPath);
    } catch (error) {
        log.error("Error ensuring Config folder exists:", error);
    }
}

export async function ensureAppDataFolders() {
    try {
        const appDataPath = await appLocalDataDir();
        await ensureFolderExists(appDataPath);
        await ensureFolderExists(await join(appDataPath, LIBRARY_FOLDER));
        await ensureFolderExists(await join(appDataPath, HISTORY_FOLDER));
        // the Engines folder is created by the Rust side, the webview has no access to it
        await ensureFolderExists(await join(appDataPath, THEMES_FOLDER));
    } catch (error) {
        log.error("Error ensuring AppData folders exist:", error);
    }
}

export async function listAppData(path: string) {
    const files = await readDir(path, { baseDir: BaseDirectory.AppLocalData });
    return files.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) {
            return -1;
        } else if (!a.isDirectory && b.isDirectory) {
            return 1;
        }
        return a.name.localeCompare(b.name);
    });
}

export async function renameOrCreateDataFile(
    oldName: string | undefined,
    newName: string,
    content?: string,
) {
    const path = basePath(oldName || newName);
    const oldExt = oldName ? fileOrFolderExtension(oldName) : "";
    const newExt = fileOrFolderExtension(newName);
    if (oldExt && !newExt) {
        newName = `${newName}.${oldExt}`;
    }
    const newFullPath = `${path}${sep()}${newName}`;
    if (
        oldName &&
        (await exists(oldName, { baseDir: BaseDirectory.AppLocalData }))
    ) {
        await rename(oldName, newFullPath, {
            oldPathBaseDir: BaseDirectory.AppLocalData,
            newPathBaseDir: BaseDirectory.AppLocalData,
        });
    } else {
        await writeDataFile(newFullPath, content || "");
        return newFullPath;
    }
}

// create a new file with a tentative name, appending progressive numbers if the file already exists
export async function createNewDataFile(
    folder: string,
    name: string,
    content: string,
) {
    let newName = name;
    let i = 1;
    let fullPath = "";
    // let fullPath = await join(folder, newName);
    while (
        ((fullPath = await join(folder, newName)),
        await exists(fullPath, { baseDir: BaseDirectory.AppLocalData }))
    ) {
        // the name can and with an extension, we should add a prgressive number but before the extension
        newName = createIncrementedName(name, newName, i);
        i++;
    }

    await writeDataFile(fullPath, content);
    return fullPath;
}

function createIncrementedName(name: string, newName: string, i: number) {
    let base = name;
    let ext = "";
    if (name.includes(".")) {
        const parts = name.split(".");
        ext = parts.pop() || "";
        ext = ext ? `.${ext}` : "";
        base = parts.join(".");
    }

    newName = `${base} (${i})${ext}`;
    return newName;
}

export async function createNewDataFolder(folder: string, name: string) {
    let newName = name;
    let i = 1;
    let fullPath = "";
    // let fullPath = await join(folder, newName);
    while (
        ((fullPath = await join(folder, newName)),
        await exists(fullPath, { baseDir: BaseDirectory.AppLocalData }))
    ) {
        // the name can and with an extension, we should add a prgressive number but before the extension
        // let base = name;
        // let ext = "";
        // if (name.includes(".")) {
        //     const parts = name.split(".");
        //     ext = parts.pop() || "";
        //     ext = ext ? `.${ext}` : "";
        //     base = parts.join(".");
        // }

        // newName = `${base} (${i})${ext}`;
        newName = createIncrementedName(name, newName, i);
        i++;
    }

    await mkdir(fullPath, { baseDir: BaseDirectory.AppLocalData });
    return fullPath;
}

export async function deleteDataFileOrFolder(path: string) {
    const ex = await exists(path, { baseDir: BaseDirectory.AppLocalData });
    if (ex) {
        await remove(path, {
            baseDir: BaseDirectory.AppLocalData,
            recursive: true,
        });
    }
}

export function NameWithoutExtension(name: string) {
    const dotIndex = name.lastIndexOf(".");
    const ret = dotIndex !== -1 ? name.substring(0, dotIndex) : name;
    return ret;
}

export function baseName(name: string) {
    return name.split(sep()).pop() || "";
}

export function basePath(name: string) {
    return name.split(sep()).slice(0, -1).join(sep());
}

export function fileOrFolderExtension(name: string) {
    const base = baseName(name);
    const dotIndex = base.lastIndexOf(".");
    return dotIndex !== -1 ? base.substring(dotIndex + 1) : "";
}

export function getDefaultStudyContent() {
    return "[]";
}

export async function openDataPath(path: string) {
    return invoke("open_library_path", { path });
}

export async function saveGameToHistory(pgn: string) {
    const historyPath = await join(await appLocalDataDir(), HISTORY_FOLDER);
    // read the timestamp from the pgn tag  [Timestamp "2021.09.01 12:00:00"]

    const timestamp =
        pgn.match(/\[Timestamp "([^"]+)"\]/)?.[1] ||
        new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");

    log.debug("saveGameToHistory", timestamp);

    // create a new file with the timestamp as name and the path as yyyy/MM/dd
    const date = timestamp.split("T")[0];
    const [year, month, day] = date.split("-");
    const yearFolder = await join(historyPath, year);
    await ensureFolderExists(yearFolder);

    const monthFolder = await join(yearFolder, month);
    await ensureFolderExists(monthFolder);

    const dayFolder = await join(monthFolder, day);
    await ensureFolderExists(dayFolder);

    return createNewDataFile(dayFolder, `${timestamp}.pgn`, pgn);
}
