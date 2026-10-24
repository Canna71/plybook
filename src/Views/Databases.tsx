import { Component, createResource, createSignal, For, Show } from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { ask } from "@tauri-apps/plugin-dialog";
import Button from "../components/common/Button";
import { makeErrorToast, makeToast } from "../components/common/Toast";
import {
    DatabaseInfo,
    deleteDatabase,
    GameQuery,
    GameRow,
    importDatabase,
    ImportProgress,
    listDatabases,
    searchGames,
} from "../storage/gamedb";
import "./Databases.scss";

const PAGE = 100;

const errorText = (err: unknown) =>
    err instanceof Error ? err.message : String(err);

/** Game databases: import big PGN files, search them, open a game. */
const Databases: Component = () => {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [databases, { refetch }] = createResource(listDatabases);
    const [progress, setProgress] = createSignal<ImportProgress>();
    const [importing, setImporting] = createSignal(false);

    const [form, setForm] = createSignal<GameQuery>({
        // "Find in databases" from a board passes the position
        fen: typeof params.fen === "string" ? params.fen : undefined,
    });
    const [query, setQuery] = createSignal<GameQuery>(form());
    const [results] = createResource(query, (q) =>
        searchGames({ ...q, limit: PAGE }).catch((err) => {
            makeErrorToast(errorText(err));
            return { total: 0, games: [] as GameRow[] };
        }),
    );

    const update = (patch: Partial<GameQuery>) =>
        setForm((f) => ({ ...f, ...patch }));
    const search = (e?: Event) => {
        e?.preventDefault();
        setQuery({ ...form(), offset: 0 });
    };
    const page = (delta: number) =>
        setQuery((q) => ({
            ...q,
            offset: Math.max(0, (q.offset ?? 0) + delta * PAGE),
        }));

    const runImport = async () => {
        setImporting(true);
        setProgress(undefined);
        try {
            const info = await importDatabase(setProgress);
            if (info) {
                makeToast(`${info.gameCount} games imported into ${info.name}`);
                refetch();
                search();
            }
        } catch (err) {
            makeErrorToast(errorText(err));
        } finally {
            setImporting(false);
        }
    };

    const remove = async (db: DatabaseInfo) => {
        const yes = await ask(
            `Delete the database "${db.name}" (${db.gameCount} games)? The PGN file is not touched.`,
            { title: "Re:Chess", kind: "warning" },
        );
        if (!yes) return;
        await deleteDatabase(db.id);
        refetch();
        search();
    };

    const percent = () => {
        const p = progress();
        return p && p.totalBytes
            ? Math.min(100, Math.round((100 * p.bytes) / p.totalBytes))
            : undefined;
    };
    const nameOf = (id: number) =>
        databases()?.find((d) => d.id === id)?.name ?? "";

    return (
        <div class="databases_view">
            <div class="buttons-bar">
                <Button
                    class={`is-primary ${importing() ? "is-loading" : ""}`}
                    onClick={runImport}
                    title="Import a .pgn or .pgn.zst file (TWIC, Lichess, Lumbra…)"
                >
                    Import PGN database…
                </Button>
            </div>
            <Show when={importing() && progress()}>
                {(p) => (
                    <div class="import-progress">
                        <progress
                            class="progress is-primary is-small"
                            value={percent()}
                            max="100"
                        />
                        {p().games.toLocaleString()} games
                        {p().skipped ? `, ${p().skipped} skipped` : ""}
                        {percent() !== undefined ? ` (${percent()}%)` : ""}
                    </div>
                )}
            </Show>

            <table class="table is-narrow databases-table">
                <tbody>
                    <For
                        each={databases()}
                        fallback={
                            <tr>
                                <td>
                                    No databases yet. Import a PGN file to
                                    search its games by player, opening or
                                    position.
                                </td>
                            </tr>
                        }
                    >
                        {(db) => (
                            <tr>
                                <td>
                                    <strong>{db.name}</strong>
                                </td>
                                <td>{db.gameCount.toLocaleString()} games</td>
                                <td class="source">{db.source}</td>
                                <td>
                                    <Button
                                        class="is-small is-danger is-outlined"
                                        onClick={() => remove(db)}
                                    >
                                        Delete
                                    </Button>
                                </td>
                            </tr>
                        )}
                    </For>
                </tbody>
            </table>

            <form class="search-form" onSubmit={search}>
                <div class="field is-grouped is-grouped-multiline">
                    <div class="control">
                        <div class="select is-small">
                            <select
                                value={form().databaseId ?? ""}
                                onChange={(e) =>
                                    update({
                                        databaseId: e.currentTarget.value
                                            ? +e.currentTarget.value
                                            : undefined,
                                    })
                                }
                            >
                                <option value="">All databases</option>
                                <For each={databases()}>
                                    {(db) => (
                                        <option value={db.id}>{db.name}</option>
                                    )}
                                </For>
                            </select>
                        </div>
                    </div>
                    <div class="control">
                        <input
                            class="input is-small"
                            placeholder="Player (either colour)"
                            value={form().player ?? ""}
                            onInput={(e) =>
                                update({ player: e.currentTarget.value })
                            }
                        />
                    </div>
                    <div class="control">
                        <input
                            class="input is-small eco"
                            placeholder="ECO (e.g. B9)"
                            value={form().eco ?? ""}
                            onInput={(e) =>
                                update({ eco: e.currentTarget.value })
                            }
                        />
                    </div>
                    <div class="control">
                        <div class="select is-small">
                            <select
                                value={form().result ?? ""}
                                onChange={(e) =>
                                    update({ result: e.currentTarget.value })
                                }
                            >
                                <option value="">Any result</option>
                                <option value="1-0">1-0</option>
                                <option value="1/2-1/2">½-½</option>
                                <option value="0-1">0-1</option>
                            </select>
                        </div>
                    </div>
                    <div class="control">
                        <input
                            class="input is-small elo"
                            type="number"
                            placeholder="Min Elo"
                            value={form().minElo ?? ""}
                            onInput={(e) =>
                                update({
                                    minElo: e.currentTarget.value
                                        ? +e.currentTarget.value
                                        : undefined,
                                })
                            }
                        />
                    </div>
                    <div class="control is-expanded">
                        <input
                            class="input is-small"
                            placeholder="Position (FEN): games that reached it in their first 30 plies"
                            value={form().fen ?? ""}
                            onInput={(e) =>
                                update({ fen: e.currentTarget.value })
                            }
                        />
                    </div>
                    <div class="control">
                        <button
                            class="button is-small is-primary"
                            type="submit"
                        >
                            Search
                        </button>
                    </div>
                </div>
            </form>

            <div class="results-bar">
                <Show when={results()}>
                    {(r) => (
                        <>
                            {r().total.toLocaleString()} games
                            <Show when={r().total > PAGE}>
                                {" · "}
                                <Button
                                    class="is-small"
                                    disabled={(query().offset ?? 0) === 0}
                                    onClick={() => page(-1)}
                                >
                                    Previous
                                </Button>{" "}
                                {(query().offset ?? 0) + 1}–
                                {Math.min(
                                    (query().offset ?? 0) + PAGE,
                                    r().total,
                                )}{" "}
                                <Button
                                    class="is-small"
                                    disabled={
                                        (query().offset ?? 0) + PAGE >=
                                        r().total
                                    }
                                    onClick={() => page(1)}
                                >
                                    Next
                                </Button>
                            </Show>
                        </>
                    )}
                </Show>
            </div>
            <div class="table-container">
                <table class="table is-narrow is-hoverable is-fullwidth games-table">
                    <thead>
                        <tr>
                            <th>White</th>
                            <th>Black</th>
                            <th>Result</th>
                            <th>Date</th>
                            <th>ECO</th>
                            <th>Event</th>
                            <th>Moves</th>
                            <th>Database</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={results()?.games}>
                            {(game) => (
                                <tr
                                    class="game-row"
                                    onClick={() =>
                                        navigate(
                                            `/game?source=database&id=${game.id}`,
                                        )
                                    }
                                >
                                    <td>
                                        {game.white}
                                        {game.whiteElo
                                            ? ` (${game.whiteElo})`
                                            : ""}
                                    </td>
                                    <td>
                                        {game.black}
                                        {game.blackElo
                                            ? ` (${game.blackElo})`
                                            : ""}
                                    </td>
                                    <td>{game.result}</td>
                                    <td>{game.date}</td>
                                    <td title={game.opening}>{game.eco}</td>
                                    <td>{game.event}</td>
                                    <td>{Math.ceil(game.plies / 2)}</td>
                                    <td>{nameOf(game.databaseId)}</td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Databases;
