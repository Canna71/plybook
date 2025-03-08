import { Component, createResource, For } from "solid-js";
import { getHistoryGames, getIdValue } from "../storage/db";
import Button from "../components/common/Button";
import { formatDate } from "../components/common/utils";
import { useNavigate } from "@solidjs/router";
import "./History.scss";

const History: Component = () => {
    const [historyGames, { refetch }] = createResource(getHistoryGames);
    const navigate = useNavigate();

    const viewGame = (id: string | undefined) => {
        if (!id) {
            return;
        }
        navigate(`/game?id=${id}&source=history`);
    };

    return (
        <div class="history_view">
            <div class="buttons-bar">
                <Button class="is-primary is-outlined" onClick={refetch}>Refresh</Button>
            </div>
            <div class="table-container">
                <table class="table history_table is-hoverable">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>White</th>
                            <th>Black</th>
                            <th>Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For
                            each={historyGames()}
                            fallback={
                                <tr>
                                    <td colspan="4">No game history found</td>
                                </tr>
                            }
                        >
                            {(game) => (
                                <tr class="history-row" onClick={() => viewGame(getIdValue(game.id?.id))}>
                                    <td>{formatDate(game.eventDate)}</td>
                                    <td>{game.whiteName || "Player"}</td>
                                    <td>{game.blackName || "Engine"}</td>
                                    <td>{game.result || "*"}</td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default History;
