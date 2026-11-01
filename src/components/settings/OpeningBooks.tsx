import { Component, createResource, createSignal, For, Show } from "solid-js";
import Button from "../common/Button";
import { makeErrorToast, makeToast } from "../common/Toast";
import { getSettingValue, setSettingValue } from "../../models/settings";
import {
    buildBook,
    BuildProgress,
    ENGINE_BOOK_SETTING,
    importBook,
    listBooks,
    removeBook,
} from "../../storage/books";

/** The ratings a book can be made from: both players at least this (0: every game) */
const RATINGS = [0, 1800, 2000, 2200, 2400];

/**
 * Polyglot opening books: for the explorer, the engine's openings when playing, and the
 * review's book moves. Imported, or made here from a PGN of games (P1.7).
 */
const OpeningBooks: Component = () => {
    const [books, { refetch }] = createResource(listBooks);
    const [minElo, setMinElo] = createSignal(2000);
    const [progress, setProgress] = createSignal<BuildProgress>();
    const [building, setBuilding] = createSignal(false);

    const add = async () => {
        try {
            const name = await importBook();
            if (name) {
                makeToast(`${name} added`);
                refetch();
            }
        } catch (err) {
            makeErrorToast(String(err));
        }
    };

    const make = async () => {
        setBuilding(true);
        setProgress(undefined);
        try {
            const made = await buildBook(
                // the first 12 moves, each played in at least 5 games
                { minElo: minElo(), plies: 24, minGames: 5 },
                setProgress,
            );
            if (made) {
                makeToast(
                    `${made.name}: ${made.entries.toLocaleString()} moves from ${made.used.toLocaleString()} of ${made.games.toLocaleString()} games`,
                );
                refetch();
            }
        } catch (err) {
            makeErrorToast(String(err));
        } finally {
            setBuilding(false);
        }
    };

    const remove = async (name: string) => {
        await removeBook(name);
        if (getSettingValue(ENGINE_BOOK_SETTING, "") === name) {
            await setSettingValue(ENGINE_BOOK_SETTING, "");
        }
        refetch();
    };

    const percent = () => {
        const p = progress();
        return p?.totalBytes ? Math.round((100 * p.bytes) / p.totalBytes) : 0;
    };

    return (
        <section class="settings-section">
            <h2 class="title is-4">Opening books</h2>
            <p class="settings-help">
                Polyglot books (.bin) show their moves in the Explorer tab, the
                engine can play from one when you play against it (Playing
                Settings), and the review does not grade the moves they hold.
                Import a book you have, or make one from games: a PGN file, also
                compressed (.pgn.zst), such as a month of the Lichess database
                (database.lichess.org, free to use).
            </p>
            <Show when={(books()?.length ?? 0) > 0}>
                <table class="table is-narrow">
                    <tbody>
                        <For each={books()}>
                            {(name) => (
                                <tr>
                                    <td>{name}</td>
                                    <td>
                                        <Button
                                            class="is-small is-danger is-outlined"
                                            onClick={() => remove(name)}
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
            <div class="buttons">
                <Button class="is-primary" onClick={add} disabled={building()}>
                    Import book…
                </Button>
                <Button onClick={make} disabled={building()}>
                    Make a book from games…
                </Button>
                <div class="select is-small">
                    <select
                        value={minElo()}
                        disabled={building()}
                        title="Only games where both players are rated at least this"
                        onChange={(e) =>
                            setMinElo(Number(e.currentTarget.value))
                        }
                    >
                        <For each={RATINGS}>
                            {(r) => (
                                <option value={r}>
                                    {r ? `both players ${r}+` : "every game"}
                                </option>
                            )}
                        </For>
                    </select>
                </div>
            </div>
            <Show when={building() && progress()}>
                {(p) => (
                    <p class="settings-help">
                        Reading games: {p().games.toLocaleString()} (
                        {p().used.toLocaleString()} used), {percent()}%…
                    </p>
                )}
            </Show>
        </section>
    );
};

export default OpeningBooks;
