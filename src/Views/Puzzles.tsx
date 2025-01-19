import { Component, createResource, For } from "solid-js";
import {
    listPuzzles,
    pickPuzzle,
    Study,
} from "../storage/db";
import Button from "../components/common/Button";
import { formatDate, round } from "../components/common/utils";
import "./Puzzles.scss";
import { useNavigate } from "@solidjs/router";

const Puzzles: Component = () => {
    const [puzzles] = createResource<Study[] | undefined>(
        listPuzzles,
    );
    const navigate = useNavigate();

    const nextPuzzle = async () => {
        const puzzle = await pickPuzzle();
        console.log("Picked puzzle", puzzle.file_path);
        navigate(`/puzzle?path=${puzzle.file_path}`);
    };

    // const onUpdateWeights = async () => {
    //     await updateCachedWeights();
    //     refetch();
    // };

    return (
        <div class="puzzles_view ">
            <div class="buttons-bar">
                <Button class="is-primary" onClick={nextPuzzle}>Pick Puzzle</Button>
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
                                            href={`/puzzle?path=${study.file_path}`}
                                        >
                                            {study.file_path}
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
