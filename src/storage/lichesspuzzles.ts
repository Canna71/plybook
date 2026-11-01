import { Channel, invoke } from "@tauri-apps/api/core";
import { LichessPuzzle } from "../models/lichesspuzzle";
import { getSettingValue } from "../models/settings";

// Mirrors src-tauri/src/lichess_puzzles.rs

export type ThemeStats = { theme: string; attempts: number; solved: number };

export type PuzzleStats = {
    count: number;
    rating: number;
    attempts: number;
    solved: number;
    /** Themes tried, the weakest first */
    themes: ThemeStats[];
};

export type PuzzleImportEvent =
    | { phase: "download"; bytes: number; total: number }
    | { phase: "import"; puzzles: number; bytes: number; total: number };

export const THEME_SETTING = "puzzles.lichess.theme";
/** Puzzles are picked within this many points of the player's rating */
const RATING_WINDOW = 150;

export const puzzleStats = () => invoke<PuzzleStats>("lichess_puzzle_stats");

export const getLichessPuzzle = (id: string) =>
    invoke<LichessPuzzle>("lichess_puzzle_get", { id });

/** Records the first try at a puzzle; resolves to the new rating. */
export const recordPuzzleAttempt = (id: string, solved: boolean) =>
    invoke<number>("lichess_puzzle_attempt", { id, solved });

/** A puzzle not tried yet, of the chosen theme, near the player's rating. */
export async function pickNextLichessPuzzle(theme?: string) {
    const { rating } = await puzzleStats();
    const chosen = theme ?? getSettingValue(THEME_SETTING, "");
    return (
        (await invoke<LichessPuzzle | null>("lichess_puzzle_pick", {
            theme: chosen || null,
            minRating: Math.round(rating - RATING_WINDOW),
            maxRating: Math.round(rating + RATING_WINDOW),
        })) ?? undefined
    );
}

function channel(onEvent: (event: PuzzleImportEvent) => void) {
    const ch = new Channel<PuzzleImportEvent>();
    ch.onmessage = onEvent;
    return ch;
}

/** Downloads the Lichess puzzle database (about 300 MB) and imports it. */
export const downloadLichessPuzzles = (
    minPopularity: number,
    onEvent: (event: PuzzleImportEvent) => void,
) =>
    invoke<number>("lichess_puzzle_download", {
        minPopularity,
        onEvent: channel(onEvent),
    });

/** Imports a puzzle CSV picked with the native dialog; undefined if cancelled. */
export const importLichessPuzzleFile = async (
    minPopularity: number,
    onEvent: (event: PuzzleImportEvent) => void,
) =>
    (await invoke<number | null>("lichess_puzzle_import_file", {
        minPopularity,
        onEvent: channel(onEvent),
    })) ?? undefined;
