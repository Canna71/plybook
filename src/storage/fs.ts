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

/** Writes text, or bytes as they are (a PDF, say). */
export async function writeDataFile(
    subPath: string,
    data: string | Uint8Array,
) {
    const bytes =
        typeof data === "string" ? new TextEncoder().encode(data) : data;
    return writeFile(subPath, bytes, {
        baseDir: BaseDirectory.AppLocalData,
    });
}

/** The bytes of a file in the app's data folder. */
export const readDataBytes = (subPath: string) =>
    readFile(subPath, { baseDir: BaseDirectory.AppLocalData });

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

/** Renames a file or folder in its folder to `newName` (the whole name, see `renamedName`); never
 * over another one. The new path. */
export async function renameDataFile(path: string, newName: string) {
    if (!newName || newName.startsWith(".")) throw new Error("No name given");
    const newPath = `${basePath(path)}${sep()}${newName}`;
    if (newPath === path) return path;
    // a different case of the same name is the same file on macOS and Windows
    if (
        newPath.toLowerCase() !== path.toLowerCase() &&
        (await exists(newPath, { baseDir: BaseDirectory.AppLocalData }))
    ) {
        throw new Error(`“${newName}” already exists`);
    }
    await rename(path, newPath, {
        oldPathBaseDir: BaseDirectory.AppLocalData,
        newPathBaseDir: BaseDirectory.AppLocalData,
    });
    return newPath;
}

// create a new file with a tentative name, appending progressive numbers if the file already exists
export async function createNewDataFile(
    folder: string,
    name: string,
    content: string | Uint8Array,
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

/** Moves a file or folder into another Library folder, as "name (1)" if the name is taken
 * there; nothing is overwritten. The new path. */
export async function moveDataFile(path: string, folder: string) {
    const name = baseName(path);
    let newName = name;
    let i = 1;
    let fullPath = "";
    while (
        ((fullPath = await join(folder, newName)),
        await exists(fullPath, { baseDir: BaseDirectory.AppLocalData }))
    ) {
        newName = createIncrementedName(name, newName, i);
        i++;
    }
    await rename(path, fullPath, {
        oldPathBaseDir: BaseDirectory.AppLocalData,
        newPathBaseDir: BaseDirectory.AppLocalData,
    });
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

export function getDefaultStudyContent() {
    return "[]";
}

export async function openDataPath(path: string) {
    return invoke("open_library_path", { path });
}
