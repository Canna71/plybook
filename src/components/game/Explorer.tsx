import {
    batch,
    Component,
    createResource,
    createSignal,
    For,
    Show,
    useContext,
} from "solid-js";
import { useNavigate } from "@solidjs/router";
import { parseUci } from "chessops";
import { Path } from "../../models/pgn";
import {
    exploreDatabases,
    ExplorerMove,
    listDatabases,
    searchGames,
} from "../../storage/gamedb";
import { GameContext } from "./GameContext";
import "./Explorer.scss";

const percent = (part: number, total: number) =>
    total ? Math.round((100 * part) / total) : 0;

/** The moves played from the current position in the imported databases. */
const Explorer: Component = () => {
    const {
        gameSignal: [game, setGame],
        currentPathSignal: [currentPath, setCurrentPath],
    } = useContext(GameContext)!;
    const navigate = useNavigate();
    const [databases] = createResource(listDatabases);
    const [databaseId, setDatabaseId] = createSignal<number>();

    const fen = () => game()?.dataAt(currentPath() ?? Path.root)?.fen;
    const source = () => {
        const f = fen();
        return f ? { fen: f, databaseId: databaseId() } : undefined;
    };
    const [moves] = createResource(source, (s) =>
        exploreDatabases(s.fen, s.databaseId).catch(() => [] as ExplorerMove[]),
    );
    const [games] = createResource(source, (s) =>
        searchGames({ fen: s.fen, databaseId: s.databaseId, limit: 10 }).catch(
            () => undefined,
        ),
    );
    const total = () => moves()?.reduce((sum, m) => sum + m.games, 0) ?? 0;

    const play = (uci: string) => {
        const g = game();
        const move = parseUci(uci);
        if (!g || !move) return;
        const [next, path] = g.applyMoves(currentPath() ?? Path.root, [move]);
        batch(() => {
            setGame(next);
            setCurrentPath(path);
        });
    };

    return (
        <div class="explorer">
            <Show
                when={(databases()?.length ?? 0) > 0}
                fallback={
                    <p class="explorer-hint">
                        Import a PGN database (Databases in the sidebar) to see
                        which moves were played here and how they scored.
                    </p>
                }
            >
                <div class="select is-small">
                    <select
                        value={databaseId() ?? ""}
                        onChange={(e) =>
                            setDatabaseId(
                                e.currentTarget.value
                                    ? +e.currentTarget.value
                                    : undefined,
                            )
                        }
                    >
                        <option value="">All databases</option>
                        <For each={databases()}>
                            {(db) => <option value={db.id}>{db.name}</option>}
                        </For>
                    </select>
                </div>
                <Show
                    when={(moves()?.length ?? 0) > 0}
                    fallback={
                        <p class="explorer-hint">
                            No games reached this position. Only the first 30
                            plies of each game are indexed.
                        </p>
                    }
                >
                    <table class="table is-narrow is-fullwidth is-hoverable">
                        <thead>
                            <tr>
                                <th>Move</th>
                                <th>Games</th>
                                <th>White / draw / Black</th>
                                <th title="Average rating of the players">
                                    Elo
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <For each={moves()}>
                                {(m) => (
                                    <tr
                                        class="explorer-move"
                                        onClick={() => play(m.uci)}
                                    >
                                        <td>
                                            <strong>{m.san}</strong>
                                        </td>
                                        <td>
                                            {m.games.toLocaleString()} (
                                            {percent(m.games, total())}%)
                                        </td>
                                        <td>
                                            <div
                                                class="result-bar"
                                                title={`${m.whiteWins} / ${m.draws} / ${m.blackWins}`}
                                            >
                                                <span
                                                    class="white"
                                                    style={{
                                                        width: `${percent(m.whiteWins, m.games)}%`,
                                                    }}
                                                />
                                                <span
                                                    class="draw"
                                                    style={{
                                                        width: `${percent(m.draws, m.games)}%`,
                                                    }}
                                                />
                                                <span
                                                    class="black"
                                                    style={{
                                                        width: `${percent(m.blackWins, m.games)}%`,
                                                    }}
                                                />
                                            </div>
                                        </td>
                                        <td>{m.averageElo ?? ""}</td>
                                    </tr>
                                )}
                            </For>
                        </tbody>
                    </table>
                    <Show when={games()?.games.length}>
                        <h3 class="title is-6">
                            Games ({games()!.total.toLocaleString()})
                        </h3>
                        <ul class="explorer-games">
                            <For each={games()!.games}>
                                {(g) => (
                                    <li
                                        onClick={() =>
                                            navigate(
                                                `/game?source=database&id=${g.id}`,
                                            )
                                        }
                                    >
                                        {g.white} – {g.black} {g.result}{" "}
                                        <span class="explorer-date">
                                            {g.date}
                                        </span>
                                    </li>
                                )}
                            </For>
                        </ul>
                    </Show>
                </Show>
            </Show>
        </div>
    );
};

export default Explorer;
