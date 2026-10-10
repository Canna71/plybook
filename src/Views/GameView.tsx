import {
    batch,
    createEffect,
    createMemo,
    createResource,
    createSignal,
    Setter,
    Show,
} from "solid-js";
import { save } from "@tauri-apps/plugin-dialog";
// import { BaseDirectory, readTextFile } from '@tauri-apps/plugin-fs';
import GameManager from "../components/game/GameManager";
import {
    baseName,
    getDefaultStudyContent,
    NameWithoutExtension,
    readDataFile,
    renameOrCreateDataFile,
    writeDataFile,
} from "../storage/fs";
import { useLocation, useNavigate, useSearchParams } from "@solidjs/router";
import { IconDeviceFloppy } from "@tabler/icons-solidjs";
import "./GameView.scss";
import Editable from "../components/common/Editable";
import { useContentContext } from "../components/common/ContentContext";
import { message } from "@tauri-apps/plugin-dialog";
import {
    createPuzzle,
    deletePuzzle,
    getStudy,
    pickPuzzle,
    updateBaseWeight,
    updatePerformanceScore,
} from "../storage/db";
import { calculatePerformanceScore } from "../models/puzzles";
import Select, { Option } from "../components/common/Select";
import Button from "../components/common/Button";
import BreadCrumb from "../components/common/BreadCrumb";
import { sep } from "@tauri-apps/api/path";
import anylogger from "anylogger";
const log = anylogger("gameview");

const GameView = () => {
    const [originalPgn, setOriginalPgn] = createSignal<string | undefined>(
        undefined,
    );
    const [newPgn, setNewPgn] = createSignal<string | undefined>(undefined);
    const [modified, setModified] = createSignal(false);
    const [searchParams, _setSearchParams] = useSearchParams();
    const location = useLocation();
    const { refresh } = useContentContext();
    const navigate = useNavigate();

    const displayedName = () => {
        const path = searchParams.path;
        if (path && typeof path === "string") {
            return NameWithoutExtension(baseName(path));
        }
        return "Untitled";
    };

    const filePath = () => {
        if (typeof searchParams.path === "string") {
            return searchParams.path;
        }
        return undefined;
    };

    const folderPath = () => {
        const path = filePath();
        if (path) {
            return path.substring(0, path.lastIndexOf(sep()));
        }
    };

    const fetchStudy = async (path: string) => {
        const studyId = path;
        try {
            return await getStudy(studyId);
        } catch (e) {
            return undefined;
        }
    };
    const [study] = createResource(filePath, fetchStudy);

    createEffect(async () => {
        // onRefresh();
        let pgnText = getDefaultStudyContent();
        if (typeof searchParams.path === "string") {
            try {
                pgnText = await readDataFile(searchParams.path);
            } catch (e) {
                // Shows message
                message("Error reading file: \n" + searchParams.path, {
                    title: "Re:Chess",
                    kind: "error",
                });
                log.error(e);
            }
        } else {
        }
        batch(() => {
            setNewPgn(pgnText); // this is to avoid detecting changes on the new pgn
            setOriginalPgn(pgnText);
        });
        setModified(false);
    });

    const memoNewPgn = createMemo(newPgn, undefined, {
        equals: (a, b) => {
            return a === b;
        },
    });

    createEffect(() => {
        const pgnText = memoNewPgn();
        setModified(!!pgnText);
    });

    const isEngineAnalysisOn = () => {
        return location.pathname === "/analysis";
    };

    const isPuzzleMode = () => {
        return location.pathname === "/puzzle";
    };

    const isEditable = () => {
        return !isPuzzleMode(); // TODO: Check if the source is writable
    };

    const canSave = () => modified();

    const onSave = async () => {
        const pgnText = newPgn();
        if (pgnText) {
            if (typeof searchParams.path === "string") {
                await writeDataFile(searchParams.path, pgnText);
                // await writeDataFile("test.pgn", pgnText);
                setModified(false);
                refresh();
            } else {
                const path = await save({
                    filters: [
                        {
                            name: "PGN File",
                            extensions: ["pgn"],
                        },
                    ],
                });
                path && (await writeDataFile(path, pgnText));
                path && setModified(false);
            }
        }
    };

    const onRename = async (text: string) => {
        await renameOrCreateDataFile(
            filePath(),
            text,
            newPgn() || getDefaultStudyContent(),
        );
        refresh();
    };

    const onPuzzleFinished = async (
        solved: boolean,
        hintUsed: number,
        retries: number,
    ) => {
        // puzzle solved
        const score = calculatePerformanceScore(
            solved, // solved
            hintUsed, // hints used
            retries, // retries
            0, // expected time
            0, // time taken
        );
        updatePerformanceScore(filePath()!, score);
    };

    const puzzlePriorities = () => {
        return [
            { value: "0", label: "None" },
            { value: "100", label: "Very Low" },
            { value: "200", label: "Low" },
            { value: "300", label: "Medium" },
            { value: "400", label: "High" },
            { value: "500", label: "Very High" },
        ] as Option[];
    };

    const puzzlePriority = createMemo(() => {
        return study()?.puzzle?.base_weight.toString() || "0";
    });

    const onChangePuzzlePriority = async (value: string) => {
        const weight = parseInt(value);
        const studyId = filePath()!;
        if (weight <= 0 && study() !== undefined) {
            await deletePuzzle(studyId);
        } else {
            if (study() === undefined) {
                await createPuzzle(studyId, weight);
            } else {
                await updateBaseWeight(studyId, weight);
            }
        }
    };

    const onNextPuzzle = async () => {
        const puzzle = await pickPuzzle();
        navigate(`/puzzle?path=${puzzle.file_path}`, { replace: true });
    };

    return (
        <>
            <nav class="game-header buttons buttons-bar" role="navigation">
                <div class="game-name">
                    <BreadCrumb path={folderPath} />
                    <Editable
                        editable={() => false}
                        initialValue={displayedName() || ""}
                        onSave={onRename}
                    ></Editable>
                </div>

                <Show when={isEditable() || isPuzzleMode()}>
                    <Show when={isPuzzleMode()}>
                        <div class="navbar-item">
                            <Button
                                class="is-primary is-outlined"
                                onClick={onNextPuzzle}
                            >
                                Next Puzzle
                            </Button>
                        </div>
                    </Show>

                    <div class="navbar-item">
                        <Select
                            title={"Puzzle Priority"}
                            options={puzzlePriorities}
                            selectedValue={puzzlePriority}
                            setSelectedValue={
                                onChangePuzzlePriority as Setter<string>
                            }
                        />
                    </div>

                    <div class="navbar-item">
                        <button
                            disabled={!canSave()}
                            class="button is-primary"
                            onClick={onSave}
                        >
                            <IconDeviceFloppy />
                            Save
                        </button>
                    </div>
                </Show>
            </nav>
            <GameManager
                initalPgn={originalPgn}
                setPgn={setNewPgn}
                onPuzzleFinished={isPuzzleMode() ? onPuzzleFinished : undefined}
                editable={isEditable}
                defaultEngineAnalysisOn={isEngineAnalysisOn()}
            />
        </>
    );
};

export default GameView;
