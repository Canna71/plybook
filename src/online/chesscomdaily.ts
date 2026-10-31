// chess.com's daily puzzle (F.30): fetched by Rust (net.rs) and opened as a puzzle, from a
// pasted link or shared result, or from the Puzzles screen.

import { invoke } from "@tauri-apps/api/core";
import {
    ChesscomPuzzle,
    chesscomPuzzlePgn,
    isPuzzleOf,
} from "../models/chesscompuzzle";
import { setPendingPgn } from "../paste/pending";
import { makeErrorToast, makeToast } from "../components/common/Toast";

/** Opens today's puzzle; with the link of another day's, says why it can't. */
export async function openChesscomDaily(
    navigate: (to: string) => void,
    url?: string,
) {
    let puzzle: ChesscomPuzzle;
    try {
        puzzle = await invoke<ChesscomPuzzle>("online_chesscom_daily_puzzle");
    } catch (err) {
        makeErrorToast(String(err));
        return;
    }
    if (url && !isPuzzleOf(puzzle, url)) {
        const day = url.slice(url.lastIndexOf("/") + 1);
        makeToast(
            `chess.com shares only today's daily puzzle, not the one of ${day}`,
            6000,
        );
        return;
    }
    const pgn = chesscomPuzzlePgn(puzzle);
    if (!pgn) {
        makeErrorToast("chess.com's daily puzzle could not be read");
        return;
    }
    setPendingPgn(pgn);
    navigate("/puzzle?source=pasted");
}
