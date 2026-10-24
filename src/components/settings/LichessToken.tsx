import { Component, createResource, createSignal, Show } from "solid-js";
import Button from "../common/Button";
import { makeErrorToast, makeToast } from "../common/Toast";
import {
    deleteSecret,
    openLichessTokenPage,
    saveSecret,
    secretStatus,
} from "../../storage/secrets";

/**
 * The Lichess personal token for the opening explorer. It goes into the OS keychain; this
 * page only ever learns whether one is saved.
 */
const LichessToken: Component = () => {
    const [status, { refetch }] = createResource(secretStatus);
    const [value, setValue] = createSignal("");

    const save = async (e: Event) => {
        e.preventDefault();
        try {
            await saveSecret("lichess_token", value());
            setValue("");
            makeToast("Lichess token saved in the keychain");
            refetch();
        } catch (err) {
            makeErrorToast(String(err));
        }
    };

    const remove = async () => {
        await deleteSecret("lichess_token");
        refetch();
    };

    return (
        <section class="settings-section">
            <h2 class="title is-4">Lichess token</h2>
            <p class="settings-help">
                The Lichess opening explorer (masters and Lichess games) needs a
                personal token from your Lichess account; it needs no
                permissions. It is kept in your system's keychain and only sent
                to Lichess.
            </p>
            <Show
                when={status()?.lichessToken}
                fallback={
                    <form class="field has-addons" onSubmit={save}>
                        <div class="control">
                            <input
                                class="input"
                                type="password"
                                autocomplete="off"
                                placeholder="lip_…"
                                value={value()}
                                onInput={(e) => setValue(e.currentTarget.value)}
                            />
                        </div>
                        <div class="control">
                            <button
                                class="button is-primary"
                                type="submit"
                                disabled={!value().trim()}
                            >
                                Save
                            </button>
                        </div>
                        <div class="control">
                            <Button
                                type="button"
                                onClick={() => openLichessTokenPage()}
                                title="Opens Lichess in your browser"
                            >
                                Create a token on Lichess…
                            </Button>
                        </div>
                    </form>
                }
            >
                <div class="buttons">
                    <span>Token saved in the keychain.</span>
                    <Button
                        class="is-small is-danger is-outlined"
                        onClick={remove}
                    >
                        Remove
                    </Button>
                </div>
            </Show>
        </section>
    );
};

export default LichessToken;
