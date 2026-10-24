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
    createNewDataFile,
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
    getHistoryGame,
    getStudy,
    pickPuzzle,
    saveHistoryGame,
    updateBaseWeight,
    updatePerformanceScore,
} from "../storage/db";
import { historyTitle } from "../models/history";
import { mistakesFolder } from "../storage/mistakes";
import { makeToast } from "../components/common/Toast";
import {
    getLichessPuzzle,
    pickNextLichessPuzzle,
    recordPuzzleAttempt,
} from "../storage/lichesspuzzles";
import { lichessPuzzlePgn } from "../models/lichesspuzzle";
import { calculatePerformanceScore } from "../models/puzzles";
import Select, { Option } from "../components/common/Select";
import Button from "../components/common/Button";
import BreadCrumb from "../components/common/BreadCrumb";
import { join, sep } from "@tauri-apps/api/path";
import { BaseDirectory, mkdir } from "@tauri-apps/plugin-fs";
import { getDatabaseGame } from "../storage/gamedb";
import { makeGame } from "../models/pgn";
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

    /** A game played against the engine, opened from History */
    const historyId = () =>
        searchParams.source === "history" && typeof searchParams.id === "string"
            ? searchParams.id
            : undefined;
    const [historyName, setHistoryName] = createSignal<string>();
    /** A puzzle from the Lichess puzzle database */
    const lichessPuzzleId = () =>
        searchParams.source === "lichess" && typeof searchParams.id === "string"
            ? searchParams.id
            : undefined;
    // only the first try at a puzzle counts, as on Lichess
    let recordedPuzzle: string | undefined;

    /** A game from an imported database (read-only: Save copies it to the Library) */
    const databaseGameId = () =>
        searchParams.source === "database" &&
        typeof searchParams.id === "string"
            ? Number(searchParams.id)
            : undefined;

    const displayedName = () => {
        const path = searchParams.path;
        if (path && typeof path === "string") {
            return NameWithoutExtension(baseName(path));
        }
        return historyName() ?? "Untitled";
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
        } catch {
            return undefined;
        }
    };
    const [study] = createResource(filePath, fetchStudy);

    createEffect(async () => {
        // onRefresh();
        let pgnText = getDefaultStudyContent();
        // a position from elsewhere (a scan, the editor): start the analysis from it
        if (typeof searchParams.fen === "string") {
            const fen = searchParams.fen.replace(/["\\]/g, "");
            pgnText = `[SetUp "1"]\n[FEN "${fen}"]\n\n*\n`;
        }
        const id = historyId();
        const dbId = databaseGameId();
        const lichessId = lichessPuzzleId();
        if (lichessId) {
            try {
                const puzzle = await getLichessPuzzle(lichessId);
                pgnText = lichessPuzzlePgn(puzzle) ?? pgnText;
                setHistoryName(
                    `Lichess puzzle ${puzzle.id} (${puzzle.rating})`,
                );
            } catch (e) {
                message("Error reading the puzzle: \n" + String(e), {
                    title: "Re:Chess",
                    kind: "error",
                });
                log.error(e);
            }
        } else if (dbId !== undefined) {
            try {
                pgnText = await getDatabaseGame(dbId);
                const game = makeGame(pgnText);
                setHistoryName(
                    historyTitle(
                        game.players.white.name,
                        game.players.black.name,
                    ),
                );
            } catch (e) {
                message("Error reading game from database: \n" + String(e), {
                    title: "Re:Chess",
                    kind: "error",
                });
                log.error(e);
            }
        } else if (id) {
            try {
                const game = await getHistoryGame(id);
                if (!game) throw new Error(`Game ${id} not found in history`);
                pgnText = game.pgn;
                setHistoryName(historyTitle(game.whiteName, game.blackName));
            } catch (e) {
                message("Error reading game from history: \n" + String(e), {
                    title: "Re:Chess",
                    kind: "error",
                });
                log.error(e);
            }
        } else if (typeof searchParams.path === "string") {
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

    const canSave = () => modified() || databaseGameId() !== undefined;

    const onSave = async () => {
        const pgnText = newPgn();
        if (pgnText) {
            if (databaseGameId() !== undefined) {
                // copy into the Library, where it can be annotated
                const folder = await join("Library", "From databases");
                await mkdir(folder, {
                    baseDir: BaseDirectory.AppLocalData,
                    recursive: true,
                });
                const path = await createNewDataFile(
                    folder,
                    `${displayedName().replace(/[\\/:*?"<>|]/g, "-")}.pgn`,
                    pgnText,
                );
                refresh();
                navigate(`/game?path=${encodeURIComponent(path)}`);
            } else if (historyId()) {
                if (await saveHistoryGame(pgnText, historyId()))
                    setModified(false);
            } else if (typeof searchParams.path === "string") {
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
        const lichessId = lichessPuzzleId();
        if (lichessId) {
            if (recordedPuzzle === lichessId) return;
            recordedPuzzle = lichessId;
            const firstTry = solved && hintUsed === 0 && retries === 0;
            const rating = await recordPuzzleAttempt(lichessId, firstTry);
            makeToast(`Puzzle rating: ${Math.round(rating)}`);
            return;
        }
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
        if (lichessPuzzleId()) {
            const next = await pickNextLichessPuzzle();
            if (!next) {
                makeToast("No new puzzle of this theme near your rating");
                return;
            }
            navigate(`/puzzle?source=lichess&id=${next.id}`, { replace: true });
            return;
        }
        // training mistakes from reviewed games stays within them
        const mistakes = await mistakesFolder();
        const inMistakes = filePath()?.startsWith(mistakes + sep());
        const puzzle = await pickPuzzle(inMistakes ? mistakes : undefined);
        if (!puzzle) {
            makeToast("No more puzzles");
            return;
        }
        navigate(`/puzzle?path=${encodeURIComponent(puzzle.file_path)}`, {
            replace: true,
        });
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

                    <Show when={filePath() && !isPuzzleMode()}>
                        <div class="navbar-item">
                            <Button
                                class="is-primary is-outlined"
                                title="Name your candidate moves at each turn, then compare with the game and the engine"
                                onClick={() =>
                                    navigate(
                                        `/guess?path=${encodeURIComponent(filePath()!)}`,
                                    )
                                }
                            >
                                Guess the move
                            </Button>
                        </div>
                    </Show>
                    <Show when={filePath()}>
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
                    </Show>

                    <Show when={!lichessPuzzleId()}>
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
