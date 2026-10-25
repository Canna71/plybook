import { invoke } from "@tauri-apps/api/core";
import anylogger from "anylogger";
import { getSettingValue } from "../models/settings";
const log = anylogger("backup");

/** Automatic daily backups on/off (on by default). */
export const AUTO_BACKUP_SETTING = "backup.auto";

export type RestoreReport = {
    files: number;
    /** The backup of the data as it was before restoring */
    before: string;
};

/** Backs up everything (PDFs and books too) to a zip the user picks; its path. */
export const createBackup = async () =>
    (await invoke<string | null>("backup_create")) ?? undefined;

/** Restores a backup the user picks; undefined if cancelled. */
export const restoreBackup = async () =>
    (await invoke<RestoreReport | null>("backup_restore")) ?? undefined;

export const openBackupsFolder = () => invoke<void>("backup_open_folder");

/** The daily backup, if due and switched on (a while after start, not to slow it down). */
export function scheduleAutoBackup(delay = 30_000) {
    setTimeout(async () => {
        if (!getSettingValue<boolean>(AUTO_BACKUP_SETTING, true)) return;
        try {
            const path = await invoke<string | null>("backup_auto");
            if (path) log.info("automatic backup", path);
        } catch (err) {
            log.warn("automatic backup failed", err);
        }
    }, delay);
}
