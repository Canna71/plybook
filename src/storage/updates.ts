// App updates (X.1): Tauri's updater reads latest.json from the newest GitHub release, and
// installs the update if its signature matches the public key in tauri.conf.json. Releases
// are built and published by .github/workflows/release.yml.

import anylogger from "anylogger";
import { createSignal } from "solid-js";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getSettingValue } from "../models/settings";
import { makeToast } from "../components/common/Toast";
const log = anylogger("updates");

/** Look for a new version a little after start (on by default) */
export const CHECK_UPDATES_SETTING = "updates.check";

const [available, setAvailable] = createSignal<Update>();
/** The update found by the last check, if any */
export const availableUpdate = available;

/** Asks the release feed for a newer version. */
export async function checkForUpdate(): Promise<Update | undefined> {
    const update = (await check()) ?? undefined;
    setAvailable(update);
    return update;
}

/**
 * Downloads and installs the update, then restarts the app. `progress` gets the fraction
 * downloaded, or undefined when the size is not known. On Windows the installer closes the
 * app itself.
 */
export async function installUpdate(
    update: Update,
    progress: (fraction: number | undefined) => void,
) {
    let total = 0;
    let done = 0;
    await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
            total = event.data.contentLength ?? 0;
            progress(total ? 0 : undefined);
        } else if (event.event === "Progress") {
            done += event.data.chunkLength;
            progress(total ? Math.min(1, done / total) : undefined);
        } else {
            progress(1);
        }
    });
    await relaunch();
}

/** Checks a little after start, in built apps only (a dev build has no release to compare). */
export function scheduleUpdateCheck(delay = 20_000) {
    if (import.meta.env.DEV) return;
    if (!getSettingValue<boolean>(CHECK_UPDATES_SETTING, true)) return;
    setTimeout(() => {
        checkForUpdate()
            .then((update) => {
                if (update)
                    makeToast(
                        `ReChess ${update.version} is available: install it in Settings → Updates`,
                        10_000,
                    );
            })
            .catch((e) => log.warn("update check failed", e));
    }, delay);
}
