import { Component, createResource, For } from "solid-js";
import { listPuzzles, pickPuzzle, Study } from "../storage/db";
import Button from "../components/common/Button";
import { formatDate, round } from "../components/common/utils";
import "./Puzzles.scss";
import { useNavigate } from "@solidjs/router";
import { NameWithoutExtension } from "../storage/fs";
import { mistakesFolder } from "../storage/mistakes";
import { makeToast } from "../components/common/Toast";

const Puzzles: Component = () => {
    const [puzzles] = createResource<Study[] | undefined>(listPuzzles);
    const navigate = useNavigate();

    const nextPuzzle = async (folder?: string) => {
        const puzzle = await pickPuzzle(folder);
        if (!puzzle) {
            makeToast(
                folder
                    ? "No mistakes to train yet: review a game and create puzzles from it"
                    : "No puzzles yet",
            );
            return;
        }
        navigate(`/puzzle?path=${encodeURIComponent(puzzle.file_path)}`);
    };

    // const onUpdateWeights = async () => {
    //     await updateCachedWeights();
    //     refetch();
    // };

    return (
        <div class="puzzles_view ">
            <div class="buttons-bar">
                <Button class="is-primary" onClick={() => nextPuzzle()}>
                    Pick Puzzle
                </Button>
                <Button
                    class="is-primary is-outlined"
                    title="Puzzles made from the mistakes in your reviewed games"
                    onClick={async () => nextPuzzle(await mistakesFolder())}
                >
                    Train my mistakes
                </Button>
            </div>
            {/* <Button onClick={onUpdateWeights}>Update Cached Weights</Button> */}
            <div class="table-container">
                <table class="table puzzles_table is-hoverable">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Last Played</th>
                            <th>Score</th>
                        </tr>
                    </thead>
                    <tbody>
                        <For
                            each={puzzles()}
                            fallback={
                                <tr>
                                    <td>Loading...</td>
                                </tr>
                            }
                        >
                            {(study) => (
                                <tr class=" ">
                                    <td>
                                        <a
                                            href={`/puzzle?path=${encodeURIComponent(study.file_path)}`}
                                        >
                                            {NameWithoutExtension(
                                                study.file_path,
                                            )}
                                        </a>
                                    </td>
                                    <td>
                                        {formatDate(
                                            study.puzzle?.last_played_date,
                                        )}
                                    </td>
                                    <td>
                                        {round(
                                            study.puzzle?.performance_score,
                                            2,
                                        )}
                                    </td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Puzzles;
