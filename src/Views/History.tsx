import { Component, createSignal, For, onMount, Show } from "solid-js";
import { ask } from "@tauri-apps/plugin-dialog";
import { IconTrash } from "@tabler/icons-solidjs";
import { deleteHistoryGame, Game, getHistoryGames } from "../storage/db";
import Button from "../components/common/Button";
import { makeErrorToast } from "../components/common/Toast";
import { formatDate } from "../models/format";
import { useNavigate } from "@solidjs/router";
import PageHeader from "../components/shell/PageHeader";
import "./History.scss";

/** Games listed at a time: a long history is read a page at a time (F.35) */
const PAGE = 100;

const History: Component = () => {
    const [games, setGames] = createSignal<Game[]>([]);
    const [more, setMore] = createSignal(false);
    const [loading, setLoading] = createSignal(true);
    const navigate = useNavigate();

    /** The next page, or the first again (from the start) */
    const load = async (fromStart: boolean) => {
        setLoading(true);
        const offset = fromStart ? 0 : games().length;
        const page = await getHistoryGames(PAGE, offset);
        setGames(fromStart ? page : [...games(), ...page]);
        setMore(page.length === PAGE);
        setLoading(false);
    };
    onMount(() => void load(true));

    const viewGame = (id: string | undefined) => {
        if (!id) {
            return;
        }
        navigate(`/game?id=${id}&source=history`);
    };

    const players = (game: Game) =>
        `${game.whiteName || "Player"} – ${game.blackName || "Engine"}`;

    const remove = async (e: MouseEvent, game: Game) => {
        e.stopPropagation();
        if (!game.id) return;
        const yes = await ask(
            `Delete ${players(game)} (${formatDate(game.eventDate)}) from your history?`,
            { title: "Delete", kind: "warning", okLabel: "Delete" },
        );
        if (!yes) return;
        try {
            await deleteHistoryGame(game.id);
            setGames(games().filter((g) => g.id !== game.id));
        } catch (err) {
            makeErrorToast(`Could not delete the game: ${String(err)}`);
        }
    };

    return (
        <div class="history_view">
            <PageHeader
                title="History"
                description="Your games against the engine, newest first. Click one to replay or analyse it."
            >
                <Button onClick={() => load(true)}>Refresh</Button>
            </PageHeader>
            <div class="table-container">
                <table class="table history_table is-hoverable">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>White</th>
                            <th>Black</th>
                            <th>Result</th>
                            <th />
                        </tr>
                    </thead>
                    <tbody>
                        <For
                            each={games()}
                            fallback={
                                <tr>
                                    <td colspan="5">
                                        {loading()
                                            ? "Loading…"
                                            : "No game history found"}
                                    </td>
                                </tr>
                            }
                        >
                            {(game) => (
                                <tr
                                    class="history-row"
                                    onClick={() => viewGame(game.id)}
                                >
                                    <td>{formatDate(game.eventDate)}</td>
                                    <td>{game.whiteName || "Player"}</td>
                                    <td>{game.blackName || "Engine"}</td>
                                    <td>{game.result || "*"}</td>
                                    <td class="history-actions">
                                        <button
                                            class="history-delete"
                                            title="Delete this game"
                                            onClick={(e) => remove(e, game)}
                                        >
                                            <IconTrash />
                                        </button>
                                    </td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
                <Show when={more()}>
                    <div class="history-more">
                        <Button
                            onClick={() => load(false)}
                            disabled={loading()}
                        >
                            Show more
                        </Button>
                    </div>
                </Show>
            </div>
        </div>
    );
};

export default History;
