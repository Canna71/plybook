import { Component, createResource, For } from "solid-js";
import { listPuzzles, pickPuzzle, Study } from "../storage/db";
import Button from "../components/common/Button";

const Puzzles: Component = () => {

    const [puzzles] = createResource<Study[] | undefined>(listPuzzles);

    const nextPuzzle = async () => {
        const puzzle = await pickPuzzle();
        console.log("Picked puzzle", puzzle.file_path);
    }

    return (
        <div class="puzzles_list">
            <Button onClick={nextPuzzle}>Pick Random</Button>
            <table class="table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Created At</th>
                        <th>Last Played</th>
                        <th>Cached Weight</th>
                        <th>Interval</th>
                        <th>Score</th>
                    </tr>
                </thead>
                <tbody>
                    <For each={puzzles()} fallback={<tr><td>Loading...</td></tr>}>
                        {(study) => (
                            <tr>
                                <td><a href={`/puzzle?path=${study.file_path}`}>{study.file_path}</a></td>
                                <td>{study.created_at}</td>
                                <td>{study.puzzle?.last_played_date}</td>
                                <td>{study.puzzle?.cached_weight}</td>
                                <td>{study.puzzle?.current_interval}</td>
                                <td>{study.puzzle?.performance_score}</td>
                            </tr>
                        )}
                    </For>
                </tbody>
            </table>
        </div>
    );
}

export default Puzzles;