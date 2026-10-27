import { Component, createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import anylogger from "anylogger";
import Button from "../common/Button";
import { makeErrorToast, makeToast } from "../common/Toast";
import { getSettingValue, setSettingValue } from "../../models/settings";
import { AUTO_SYNC_SETTING } from "../../online/autosync";
import {
    accountFolder,
    addAccount,
    getAccounts,
    OnlineAccount,
    OnlineSite,
    removeAccount,
    SITE_LABELS,
    syncAccount,
} from "../../online/onlinegames";
const log = anylogger("onlineaccounts");

const errorText = (err: unknown) =>
    err instanceof Error ? err.message : String(err);

const accountId = (a: OnlineAccount) => `${a.site}:${a.username}`;

const OnlineAccounts: Component = () => {
    const [site, setSite] = createSignal<OnlineSite>("chesscom");
    const [username, setUsername] = createSignal("");
    // ids of the accounts being synced
    const [syncing, setSyncing] = createSignal<string[]>([]);
    const navigate = useNavigate();

    const sync = async (account: OnlineAccount) => {
        const id = accountId(account);
        if (syncing().includes(id)) return;
        setSyncing((ids) => [...ids, id]);
        try {
            const { added } = await syncAccount(account);
            makeToast(
                added
                    ? `${added} new games from ${SITE_LABELS[account.site]}`
                    : `No new games for ${account.username}`,
            );
        } catch (err) {
            log.error("sync failed", err);
            makeErrorToast(errorText(err));
        } finally {
            setSyncing((ids) => ids.filter((i) => i !== id));
        }
    };

    const add = async (e: Event) => {
        e.preventDefault();
        if (!username().trim()) return;
        const account = await addAccount(site(), username());
        setUsername("");
        await sync(account);
    };

    const showGames = async (account: OnlineAccount) =>
        navigate(
            `/library?path=${encodeURIComponent(await accountFolder(account))}`,
        );

    return (
        <section class="settings-section">
            <h2 class="title is-4">Online accounts</h2>
            <p class="settings-help">
                Your games on chess.com and Lichess are downloaded into the
                Library, under Online, one file per month. Syncing again only
                adds new games and keeps your notes. A first sync of a large
                Lichess account can take a few minutes.
            </p>
            <label class="checkbox settings-help">
                <input
                    type="checkbox"
                    checked={getSettingValue(AUTO_SYNC_SETTING, true)}
                    onChange={(e) =>
                        void setSettingValue(
                            AUTO_SYNC_SETTING,
                            e.currentTarget.checked,
                        )
                    }
                />{" "}
                Sync on start (at most every 6 hours) and review the newest new
                games in the background; they show on Today with your mistakes.
            </label>

            <Show when={getAccounts().length > 0}>
                <table class="table is-fullwidth is-narrow accounts-table">
                    <thead>
                        <tr>
                            <th>Site</th>
                            <th>Username</th>
                            <th>Last sync</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        <For each={getAccounts()}>
                            {(account) => (
                                <tr>
                                    <td>{SITE_LABELS[account.site]}</td>
                                    <td>{account.username}</td>
                                    <td>
                                        {account.lastSync
                                            ? new Date(
                                                  account.lastSync,
                                              ).toLocaleString()
                                            : "never"}
                                    </td>
                                    <td class="actions">
                                        <Button
                                            class={`is-small is-primary ${
                                                syncing().includes(
                                                    accountId(account),
                                                )
                                                    ? "is-loading"
                                                    : ""
                                            }`}
                                            onClick={() => sync(account)}
                                        >
                                            Sync
                                        </Button>
                                        <Button
                                            class="is-small"
                                            onClick={() => showGames(account)}
                                        >
                                            Show games
                                        </Button>
                                        <Button
                                            class="is-small is-danger is-outlined"
                                            title="Forget the account; downloaded games are kept"
                                            onClick={() =>
                                                removeAccount(account)
                                            }
                                        >
                                            Remove
                                        </Button>
                                    </td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </Show>

            <form class="field has-addons" onSubmit={add}>
                <div class="control">
                    <div class="select">
                        <select
                            value={site()}
                            onChange={(e) =>
                                setSite(e.currentTarget.value as OnlineSite)
                            }
                        >
                            <option value="chesscom">chess.com</option>
                            <option value="lichess">Lichess</option>
                        </select>
                    </div>
                </div>
                <div class="control">
                    <input
                        class="input"
                        type="text"
                        placeholder="Username"
                        value={username()}
                        onInput={(e) => setUsername(e.currentTarget.value)}
                    />
                </div>
                <div class="control">
                    <button
                        class="button is-primary"
                        type="submit"
                        disabled={!username().trim()}
                    >
                        Add and sync
                    </button>
                </div>
            </form>
        </section>
    );
};

export default OnlineAccounts;
