import { Component, createSignal } from "solid-js";
import Button from "../common/Button";
import { makeErrorToast, makeToast } from "../common/Toast";
import { useContentContext } from "../common/ContentContext";
import {
    getSettingValue,
    reloadSettings,
    setSettingValue,
} from "../../models/settings";
import {
    AUTO_BACKUP_SETTING,
    createBackup,
    openBackupsFolder,
    restoreBackup,
} from "../../storage/backup";

/** Backups of the Library, settings and the user's own records (O.6). */
const Backups: Component = () => {
    const { refresh } = useContentContext();
    const [busy, setBusy] = createSignal(false);
    const [auto, setAuto] = createSignal(
        getSettingValue(AUTO_BACKUP_SETTING, true),
    );

    const run = async (task: () => Promise<void>) => {
        setBusy(true);
        try {
            await task();
        } catch (err) {
            makeErrorToast(String(err));
        } finally {
            setBusy(false);
        }
    };

    const backUp = () =>
        run(async () => {
            const path = await createBackup();
            if (path) makeToast(`Backed up to ${path}`);
        });

    const restore = () =>
        run(async () => {
            const report = await restoreBackup();
            if (!report) return;
            await reloadSettings();
            refresh();
            makeToast(
                `Restored (${report.files} files). Your data as it was is in ${report.before}`,
            );
        });

    return (
        <section class="settings-section">
            <h2 class="title is-4">Backups</h2>
            <p class="settings-help">
                A backup holds your Library (games, studies, notes, PDFs),
                settings, custom themes, and your own records: puzzle priorities
                and attempts, the history of games against the engine,
                repertoire training. Imported game databases and the Lichess
                puzzle set are left out (import them again), and so are engines.
            </p>
            <label class="checkbox">
                <input
                    type="checkbox"
                    checked={auto()}
                    onChange={(e) => {
                        setAuto(e.currentTarget.checked);
                        void setSettingValue(
                            AUTO_BACKUP_SETTING,
                            e.currentTarget.checked,
                        );
                    }}
                />{" "}
                Back up automatically once a day (the last seven are kept; PDFs
                and opening books only in backups made with "Back up now")
            </label>
            <div class="buttons mt-3">
                <Button
                    class={`is-primary ${busy() ? "is-loading" : ""}`}
                    disabled={busy()}
                    onClick={backUp}
                >
                    Back up now…
                </Button>
                <Button
                    class={busy() ? "is-loading" : ""}
                    disabled={busy()}
                    title="Replaces your records and settings with the backup's and restores its files (files not in the backup are kept). Your current data is backed up first."
                    onClick={restore}
                >
                    Restore from a backup…
                </Button>
                <Button onClick={() => void openBackupsFolder()}>
                    Open the Backups folder
                </Button>
            </div>
        </section>
    );
};

export default Backups;
