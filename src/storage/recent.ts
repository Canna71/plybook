import { addRecent, RecentFile } from "../models/today";
import { getSettingValue, setSettingValue } from "../models/settings";

export const RECENT_SETTING = "recent.files";

export const recentFiles = () =>
    getSettingValue<RecentFile[]>(RECENT_SETTING, []) ?? [];

/** Remembers that a Library file was opened, for Today's "Continue". */
export function recordRecent(path: string, kind: RecentFile["kind"]) {
    if (!path.startsWith("Library")) return;
    void setSettingValue(
        RECENT_SETTING,
        addRecent(recentFiles(), path, kind, Date.now()),
    );
}

/** Forgets a file (it was moved or deleted). */
export function forgetRecent(path: string) {
    void setSettingValue(
        RECENT_SETTING,
        recentFiles().filter((f) => f.path !== path),
    );
}
