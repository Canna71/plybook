import { join } from "@tauri-apps/api/path";
import { BaseDirectory, exists, mkdir } from "@tauri-apps/plugin-fs";
import { MistakePuzzle } from "../models/mistakes";
import { createPuzzle } from "./db";
import { writeDataFile } from "./fs";

/** Library folder of the puzzles made from reviewed games. */
export const mistakesFolder = () => join("Library", "Mistakes");

/**
 * Writes each puzzle as a PGN file and adds it to the puzzle scheduler. Puzzles already in the
 * folder (same game and move) are left alone, so creating them twice is harmless.
 */
export async function saveMistakePuzzles(puzzles: MistakePuzzle[]) {
    const folder = await mistakesFolder();
    await mkdir(folder, {
        baseDir: BaseDirectory.AppLocalData,
        recursive: true,
    });
    const created: string[] = [];
    for (const puzzle of puzzles) {
        const path = await join(folder, `${puzzle.name}.pgn`);
        if (await exists(path, { baseDir: BaseDirectory.AppLocalData })) {
            continue;
        }
        await writeDataFile(path, puzzle.pgn);
        await createPuzzle(path, puzzle.weight);
        created.push(path);
    }
    return { created, skipped: puzzles.length - created.length };
}
