import { defineConfig } from "vitest/config";

// Measurements, not tests: the move-reason detectors (src/reasons) run against the Lichess puzzle
// set and report precision/recall per theme (docs/REASONS.md). `pnpm eval:reasons`, with
// PUZZLES_CSV pointing at a (part of) lichess_db_puzzle.csv. Not part of `pnpm test` or CI.
export default defineConfig({
    test: {
        environment: "node",
        include: ["src/**/*.eval.ts"],
        testTimeout: 30 * 60_000,
    },
});
