import { Component, createResource, For } from "solid-js";
import { listPuzzles, Study } from "../storage/db";

const Puzzles: Component = () => {

    const [puzzles] = createResource<Study[] | undefined>(listPuzzles);

    return (
        <div class="puzzles_list">
            <table class="table">
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Created At</th>
                        <th>Last Played</th>
                        <th>Cached Weight</th>
                        <th>Interval</th>
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
                            </tr>
                        )}
                    </For>
                </tbody>
            </table>
        </div>
    );
}

export default Puzzles;