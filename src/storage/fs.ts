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
import { appDataDir, appLocalDataDir, join, sep } from "@tauri-apps/api/path";
// import { path } from "@tauri-apps/api";

const LIBRARY_FOLDER = "Library";
const ENGINES_FOLDER = "Engines";
const THEMES_FOLDER = "Themes";

export async function initStorage() {
    await ensureAppDataFolders();
}

export async function ensureConfigFileExists(subPath: string) {
    const fileExists = await exists(subPath, {
        baseDir: BaseDirectory.AppConfig,
    });
    if (!fileExists) {
        await writeFile(subPath, new Uint8Array(), {
            baseDir: BaseDirectory.AppConfig,
        });
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
        console.error("Error parsing JSON from file:", error);
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
    // HACK: changed tp use TextEncoder to avoid issues with "unexpected invoke body" error
    return writeFile(subPath, new TextEncoder().encode(data), {
        baseDir: BaseDirectory.AppLocalData,
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
        await ensureFolderExists(
            await join(appDataPath, LIBRARY_FOLDER, "pgn"),
        );
        await ensureFolderExists(await join(appDataPath, ENGINES_FOLDER));
        await ensureFolderExists(await join(appDataPath, THEMES_FOLDER));
    } catch (error) {
        console.error("Error ensuring AppData folders exist:", error);
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

export async function getEngineFolder(name: string) {
    const appDataDirPath = await appDataDir();
    return join(appDataDirPath, ENGINES_FOLDER, name);
}

export async function getAvailableEngines() {
    const enginesPath = await getEngineFolder("");
    return (await listAppData(enginesPath)).map((entry) => entry.name);
}

export async function renameOrCreateDataFile(
    oldName: string | undefined,
    newName: string,
    content: string,
) {
    const path = basePath(oldName || newName);
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
        await writeDataFile(newFullPath, content);
        return newFullPath;
    }
}

// create a new file with a tentative name, appending progressive numbers if the file already exists
export async function createNewDataFile(
    folder: string,
    name: string,
    content: string,
) {
    name = await join(folder, name);
    let newName = name;
    let i = 1;
    while (await exists(newName, { baseDir: BaseDirectory.AppLocalData })) {
        // the name can and with an extension, we should add a prgressive number but before the extension
        const parts = name.split(".");
        const ext = parts.pop();
        const base = parts.join(".");
        newName = `${base} (${i}).${ext}`;
        i++;
    }
    await writeDataFile(newName, content);
    return join(await appLocalDataDir(), newName);
}

export async function createNewDataFolder(folder: string, name: string) {
    let newName = name;
    let i = 1;
    let fullPath = "";
    // let fullPath = await join(folder, newName);
    while (fullPath = await join(folder, newName), await exists(fullPath, { baseDir: BaseDirectory.AppLocalData })) {
        // the name can and with an extension, we should add a prgressive number but before the extension
        let base = name;
        let ext = "";
        if (name.includes(".")) {
            const parts = name.split(".");
            ext = parts.pop() || "";
            ext = ext ? `.${ext}` : "";
            base = parts.join(".");
            // console.log("newName", parts, ext, base, newName, i);
        }

        newName = `${base} (${i})${ext}`;
        i++;
    }
    
    await mkdir(fullPath, { baseDir: BaseDirectory.AppLocalData });
    return fullPath;
}

export async function deleteDataFile(path: string) {
    const ex = await exists(path, { baseDir: BaseDirectory.AppLocalData });
    if (ex) {
        await remove(path, { baseDir: BaseDirectory.AppLocalData });
    }
}

export function NameWithoutExtension(name: string) {
    return name.replace(/\.[^/.]+$/, "");
}

export function baseName(name: string) {
    return name.split(sep()).pop() || "";
}

export function basePath(name: string) {
    return name.split(sep()).slice(0, -1).join(sep());
}
