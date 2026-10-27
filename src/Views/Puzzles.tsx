import { Component, createResource, For } from "solid-js";
import { listPuzzles, pickPuzzle, Study } from "../storage/db";
import Button from "../components/common/Button";
import { formatDate, round } from "../models/format";
import PageHeader from "../components/shell/PageHeader";
import "./Puzzles.scss";
import LichessPuzzles from "../components/puzzles/LichessPuzzles";
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

    return (
        <div class="puzzles_view ">
            <PageHeader
                title="Puzzles"
                description="Your own puzzles (studies marked as puzzles, mistakes from reviewed games) and the Lichess puzzle set."
            >
                <Button class="is-primary" onClick={() => nextPuzzle()}>
                    Pick a puzzle
                </Button>
                <Button
                    title="Puzzles made from the mistakes in your reviewed games"
                    onClick={async () => nextPuzzle(await mistakesFolder())}
                >
                    Train my mistakes
                </Button>
            </PageHeader>
            <LichessPuzzles />
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
                                    <td colspan="3" class="rc-empty">
                                        {puzzles.loading ? (
                                            "Loading…"
                                        ) : (
                                            <>
                                                <strong>
                                                    No puzzles of your own yet
                                                </strong>
                                                Open a study and give it a
                                                puzzle priority, or review a
                                                game and turn its mistakes into
                                                puzzles.
                                            </>
                                        )}
                                    </td>
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
