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
    exploreLichess,
    ExplorerMove,
    listDatabases,
    searchGames,
} from "../../storage/gamedb";
import { bookMoves, listBooks } from "../../storage/books";
import { BookMove, bookShares } from "../../models/books";
import { GameContext } from "./GameContext";
import "./Explorer.scss";

const percent = (part: number, total: number) =>
    total ? Math.round((100 * part) / total) : 0;

/** "local" (all imported databases), "local:<id>", "masters", "lichess" or "book:<file>" */
type Source = string;
const isLichess = (source: Source) =>
    source === "masters" || source === "lichess";
const bookName = (source: Source) =>
    source.startsWith("book:") ? source.slice("book:".length) : undefined;

/** The moves played from the current position: in the imported databases or on Lichess. */
const Explorer: Component = () => {
    const {
        gameSignal: [game, setGame],
        currentPathSignal: [currentPath, setCurrentPath],
    } = useContext(GameContext)!;
    const navigate = useNavigate();
    const [databases] = createResource(listDatabases);
    const [source, setSource] = createSignal<Source>("local");

    const [books] = createResource(listBooks);

    const fen = () => game()?.dataAt(currentPath() ?? Path.root)?.fen;
    // games (databases, Lichess) and books are looked up separately: different answers
    const query = () => {
        const f = fen();
        return f && !bookName(source())
            ? { fen: f, source: source() }
            : undefined;
    };
    const bookQuery = () => {
        const f = fen();
        const name = bookName(source());
        return f && name ? { fen: f, name } : undefined;
    };
    const [bookResult] = createResource(bookQuery, (q) =>
        bookMoves(q.name, q.fen).then(
            (moves) => ({ moves, error: undefined }),
            (err) => ({ moves: [] as BookMove[], error: String(err) }),
        ),
    );
    const databaseId = (s: Source) =>
        s.startsWith("local:") ? Number(s.slice("local:".length)) : undefined;

    const [result] = createResource(query, async (q) => {
        try {
            const moves = isLichess(q.source)
                ? await exploreLichess(q.fen, q.source as "masters" | "lichess")
                : await exploreDatabases(q.fen, databaseId(q.source));
            return { moves };
        } catch (err) {
            return { moves: [] as ExplorerMove[], error: String(err) };
        }
    });
    // the games list is for the imported databases only
    const [games] = createResource(query, (q) =>
        isLichess(q.source)
            ? undefined
            : searchGames({
                  fen: q.fen,
                  databaseId: databaseId(q.source),
                  limit: 10,
              }).catch(() => undefined),
    );
    const moves = () => result()?.moves ?? [];
    const total = () => moves().reduce((sum, m) => sum + m.games, 0);

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

    const emptyText = () =>
        isLichess(source())
            ? "No games reached this position."
            : (databases()?.length ?? 0) === 0
              ? "Import a PGN database (Databases in the sidebar) to see which moves were played here and how they scored, or pick the Lichess explorer."
              : "No games reached this position. Only the first 30 plies of each game are indexed.";

    return (
        <div class="explorer">
            <div class="select is-small">
                <select
                    value={source()}
                    onChange={(e) => setSource(e.currentTarget.value)}
                >
                    <option value="local">My databases</option>
                    <For each={databases()}>
                        {(db) => (
                            <option value={`local:${db.id}`}>
                                {"  "}
                                {db.name}
                            </option>
                        )}
                    </For>
                    <option value="masters">Lichess: masters</option>
                    <option value="lichess">Lichess: online games</option>
                    <For each={books()}>
                        {(name) => (
                            <option value={`book:${name}`}>Book: {name}</option>
                        )}
                    </For>
                </select>
            </div>
            <Show when={bookName(source())}>
                <BookTable
                    moves={bookResult()?.moves ?? []}
                    error={bookResult()?.error}
                    loading={bookResult.loading}
                    onPlay={play}
                />
            </Show>
            <Show when={!bookName(source())}>
                <Show when={result()?.error}>
                    <p class="notification is-warning is-light explorer-hint">
                        {result()!.error}
                    </p>
                </Show>
                <Show
                    when={moves().length > 0}
                    fallback={
                        <Show when={!result()?.error && !result.loading}>
                            <p class="explorer-hint">{emptyText()}</p>
                        </Show>
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

/** A book's moves with their share of the book's weight. */
const BookTable: Component<{
    moves: BookMove[];
    error?: string;
    loading: boolean;
    onPlay: (uci: string) => void;
}> = (props) => {
    const shares = () => bookShares(props.moves);
    return (
        <>
            <Show when={props.error}>
                <p class="notification is-warning is-light explorer-hint">
                    {props.error}
                </p>
            </Show>
            <Show
                when={props.moves.length > 0}
                fallback={
                    <Show when={!props.error && !props.loading}>
                        <p class="explorer-hint">
                            This position is not in the book.
                        </p>
                    </Show>
                }
            >
                <table class="table is-narrow is-fullwidth is-hoverable">
                    <thead>
                        <tr>
                            <th>Move</th>
                            <th title="Share of the book's weight in this position">
                                Weight
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <For each={props.moves}>
                            {(m, i) => (
                                <tr
                                    class="explorer-move"
                                    onClick={() => props.onPlay(m.uci)}
                                >
                                    <td>
                                        <strong>{m.san}</strong>
                                    </td>
                                    <td>{shares()[i()]}%</td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </Show>
        </>
    );
};

export default Explorer;
