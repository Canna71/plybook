import { BaseDirectory, exists, mkdir, readTextFile } from "@tauri-apps/plugin-fs";
import { appDataDir, appLocalDataDir } from "@tauri-apps/api/path";

export async function initStorage() {
    await ensureAppDataFolder();
}

export async function readDataFile(subPath: string) {
    return readTextFile(subPath, {
        baseDir: BaseDirectory.AppData
    });
}

export async function ensureAppDataFolder() {
    try {
      // Get the AppData directory path
      const appDataPath = await appDataDir();
  
      // Check if the directory exists
      const folderExists = await exists(appDataPath);
  
      if (!folderExists) {
        // Create the directory if it doesn't exist
        await mkdir(appDataPath, { recursive: true });
        console.log(`AppData folder created at: ${appDataPath}`);
      } else {
        console.log(`AppData folder already exists at: ${appDataPath}`);
      }
    } catch (error) {
      console.error("Error ensuring AppData folder exists:", error);
    }
  }