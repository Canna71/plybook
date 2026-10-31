import { Component, createResource, createSignal, For, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import Button from "../common/Button";
import Progress from "../common/Progress";
import { makeErrorToast, makeToast } from "../common/Toast";
import { themeLabel } from "../../models/lichesspuzzle";
import { getSettingValue, setSettingValue } from "../../models/settings";
import {
    downloadLichessPuzzles,
    importLichessPuzzleFile,
    pickNextLichessPuzzle,
    PuzzleImportEvent,
    puzzleStats,
    THEME_SETTING,
} from "../../storage/lichesspuzzles";
import "./LichessPuzzles.scss";

/** Common Lichess puzzle themes, tactical motifs first. */
const THEMES = [
    "fork",
    "pin",
    "skewer",
    "hangingPiece",
    "discoveredAttack",
    "doubleCheck",
    "sacrifice",
    "deflection",
    "attraction",
    "clearance",
    "interference",
    "intermezzo",
    "trappedPiece",
    "xRayAttack",
    "quietMove",
    "defensiveMove",
    "mateIn1",
    "mateIn2",
    "mateIn3",
    "backRankMate",
    "smotheredMate",
    "promotion",
    "advancedPawn",
    "zugzwang",
    "opening",
    "middlegame",
    "endgame",
    "rookEndgame",
    "pawnEndgame",
];

/** Popularity filters offered at import (Lichess popularity goes from -100 to 100) */
const SIZES = [
    { min: 90, label: "Popular puzzles (3.3 million, about 720 MB)" },
    { min: -100, label: "All puzzles (6.2 million, about 1.4 GB)" },
];

const errorText = (err: unknown) =>
    err instanceof Error ? err.message : String(err);

const MiB = (bytes: number) => `${Math.round(bytes / 2 ** 20)} MB`;

/** The Lichess puzzle database: import it, train by theme near your rating, see weak themes. */
const LichessPuzzles: Component = () => {
    const navigate = useNavigate();
    const [stats, { refetch }] = createResource(puzzleStats);
    const [theme, setTheme] = createSignal(getSettingValue(THEME_SETTING, ""));
    const [size, setSize] = createSignal(SIZES[0].min);
    const [progress, setProgress] = createSignal<PuzzleImportEvent>();
    const [busy, setBusy] = createSignal(false);

    const train = async (chosen = theme()) => {
        await setSettingValue(THEME_SETTING, chosen);
        setTheme(chosen);
        const puzzle = await pickNextLichessPuzzle(chosen);
        if (!puzzle) {
            makeToast("No new puzzle of this theme near your rating");
            return;
        }
        navigate(`/puzzle?source=lichess&id=${puzzle.id}`);
    };

    const runImport = async (download: boolean) => {
        setBusy(true);
        setProgress(undefined);
        try {
            const count = download
                ? await downloadLichessPuzzles(size(), setProgress)
                : await importLichessPuzzleFile(size(), setProgress);
            if (count !== undefined) {
                makeToast(`${count.toLocaleString()} puzzles imported`);
                refetch();
            }
        } catch (err) {
            makeErrorToast(errorText(err));
        } finally {
            setBusy(false);
        }
    };

    const progressText = () => {
        const p = progress();
        if (!p) return "Starting…";
        if (p.phase === "download") {
            return `Downloading ${MiB(p.bytes)} of ${MiB(p.total)}`;
        }
        return `Importing: ${p.puzzles.toLocaleString()} puzzles`;
    };
    const percent = () => {
        const p = progress();
        return p && p.total ? Math.round((100 * p.bytes) / p.total) : undefined;
    };

    const successRate = (attempts: number, solved: number) =>
        `${Math.round((100 * solved) / attempts)}%`;

    return (
        <section class="lichess-puzzles box">
            <h2 class="title is-5">Lichess puzzles</h2>
            <Show
                when={(stats()?.count ?? 0) > 0}
                fallback={
                    <div>
                        <p class="block">
                            Millions of free puzzles from Lichess, tagged by
                            theme and rating. Download them once; they stay on
                            this computer.
                        </p>
                        <div class="field is-grouped is-grouped-multiline">
                            <div class="control">
                                <div class="select is-small">
                                    <select
                                        value={size()}
                                        onChange={(e) =>
                                            setSize(+e.currentTarget.value)
                                        }
                                    >
                                        <For each={SIZES}>
                                            {(s) => (
                                                <option value={s.min}>
                                                    {s.label}
                                                </option>
                                            )}
                                        </For>
                                    </select>
                                </div>
                            </div>
                            <div class="control">
                                <Button
                                    class={`is-small is-primary ${busy() ? "is-loading" : ""}`}
                                    onClick={() => runImport(true)}
                                >
                                    Download from Lichess
                                </Button>
                            </div>
                            <div class="control">
                                <Button
                                    class="is-small"
                                    disabled={busy()}
                                    title="lichess_db_puzzle.csv or .csv.zst you already downloaded"
                                    onClick={() => runImport(false)}
                                >
                                    Import file…
                                </Button>
                            </div>
                        </div>
                    </div>
                }
            >
                <p class="block">
                    Your puzzle rating:{" "}
                    <strong>{Math.round(stats()!.rating)}</strong> ·{" "}
                    {stats()!.attempts} tried, {stats()!.solved} solved first
                    try · {stats()!.count.toLocaleString()} puzzles available
                </p>
                <div class="field has-addons">
                    <div class="control">
                        <div class="select is-small">
                            <select
                                value={theme()}
                                onChange={(e) =>
                                    setTheme(e.currentTarget.value)
                                }
                            >
                                <option value="">Any theme</option>
                                <For each={THEMES}>
                                    {(t) => (
                                        <option value={t}>
                                            {themeLabel(t)}
                                        </option>
                                    )}
                                </For>
                            </select>
                        </div>
                    </div>
                    <div class="control">
                        <Button
                            class="is-small is-primary"
                            onClick={() => train()}
                        >
                            Train
                        </Button>
                    </div>
                </div>
                <Show when={stats()!.themes.some((t) => t.attempts >= 3)}>
                    <h3 class="title is-6">Your weakest themes</h3>
                    <table class="table is-narrow">
                        <tbody>
                            <For
                                each={stats()!
                                    .themes.filter((t) => t.attempts >= 3)
                                    .slice(0, 6)}
                            >
                                {(t) => (
                                    <tr>
                                        <td>{themeLabel(t.theme)}</td>
                                        <td>
                                            {successRate(t.attempts, t.solved)}{" "}
                                            of {t.attempts}
                                        </td>
                                        <td>
                                            <Button
                                                class="is-small"
                                                onClick={() => train(t.theme)}
                                            >
                                                Train
                                            </Button>
                                        </td>
                                    </tr>
                                )}
                            </For>
                        </tbody>
                    </table>
                </Show>
            </Show>
            <Show when={busy()}>
                <div class="import-progress">
                    <Progress
                        class="progress is-primary is-small"
                        value={percent()}
                    />
                    {progressText()}
                </div>
            </Show>
        </section>
    );
};

export default LichessPuzzles;
