import { Component, createResource, createSignal, Show } from "solid-js";
import { getVersion } from "@tauri-apps/api/app";
import Button from "../common/Button";
import { makeErrorToast, makeToast } from "../common/Toast";
import { getSettingValue, setSettingValue } from "../../models/settings";
import {
    availableUpdate,
    CHECK_UPDATES_SETTING,
    checkForUpdate,
    installUpdate,
} from "../../storage/updates";

/** The app's version, a check for a newer one, and installing it (X.1). */
const Updates: Component = () => {
    const [version] = createResource(() => getVersion());
    const [checking, setChecking] = createSignal(false);
    // undefined while not installing; a fraction (or NaN, size unknown) while downloading
    const [installing, setInstalling] = createSignal<number>();
    const [auto, setAuto] = createSignal(
        getSettingValue<boolean>(CHECK_UPDATES_SETTING, true) ?? true,
    );

    const checkNow = async () => {
        setChecking(true);
        try {
            const update = await checkForUpdate();
            if (!update) makeToast("ReChess is up to date");
        } catch (err) {
            makeErrorToast(`Could not check for updates: ${err}`);
        } finally {
            setChecking(false);
        }
    };

    const install = async () => {
        const update = availableUpdate();
        if (!update) return;
        setInstalling(NaN);
        try {
            await installUpdate(update, (f) => setInstalling(f ?? NaN));
        } catch (err) {
            setInstalling(undefined);
            makeErrorToast(`Could not install the update: ${err}`);
        }
    };

    return (
        <section class="settings-section">
            <h2 class="title is-4">Updates</h2>
            <p class="settings-help">
                ReChess {version() ?? ""}. New versions are published on GitHub;
                an update is installed only if it is signed with the ReChess
                release key.
            </p>
            <label class="checkbox">
                <input
                    type="checkbox"
                    checked={auto()}
                    onChange={(e) => {
                        setAuto(e.currentTarget.checked);
                        void setSettingValue(
                            CHECK_UPDATES_SETTING,
                            e.currentTarget.checked,
                        );
                    }}
                />{" "}
                Check for a new version when ReChess starts
            </label>
            <div class="buttons mt-3">
                <Button
                    class={checking() ? "is-loading" : ""}
                    disabled={checking() || installing() !== undefined}
                    onClick={checkNow}
                >
                    Check now
                </Button>
            </div>
            <Show when={availableUpdate()}>
                {(update) => (
                    <div class="box mt-4">
                        <p>
                            <strong>ReChess {update().version}</strong> is
                            available
                            <Show when={update().date}>
                                {(date) => <> ({date().slice(0, 10)})</>}
                            </Show>
                            .
                        </p>
                        <Show when={update().body}>
                            {/* plain text: release notes are not rendered as HTML */}
                            {(body) => (
                                <p class="update-notes mt-2">{body()}</p>
                            )}
                        </Show>
                        <Show
                            when={installing() !== undefined}
                            fallback={
                                <Button
                                    class="is-primary mt-3"
                                    onClick={install}
                                >
                                    Install and restart
                                </Button>
                            }
                        >
                            <progress
                                class="progress is-primary mt-3"
                                max="1"
                                value={
                                    Number.isNaN(installing())
                                        ? undefined
                                        : installing()
                                }
                            />
                            <p class="settings-help">
                                Downloading and installing; ReChess restarts
                                when it is done.
                            </p>
                        </Show>
                    </div>
                )}
            </Show>
        </section>
    );
};

export default Updates;
