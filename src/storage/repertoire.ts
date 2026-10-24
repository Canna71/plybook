import { invoke } from "@tauri-apps/api/core";
import { Color } from "chessops";
import { parsePgn } from "chessops/pgn";
import { makeGameInternal } from "../models/pgn";
import { Card, extractLines, Line } from "../models/repertoire";
import { readDataFile } from "./fs";

// Mirrors src-tauri/src/repertoire.rs
export type Repertoire = { filePath: string; side: Color };

export const listRepertoires = () => invoke<Repertoire[]>("repertoire_list");

/** Marks a Library file as a repertoire for `side`; undefined stops (and forgets its training). */
export const setRepertoire = (filePath: string, side?: Color) =>
    invoke<void>("repertoire_set", { filePath, side: side ?? null });

export const saveRepertoireCard = (filePath: string, card: Card) =>
    invoke<void>("repertoire_save_card", { filePath, card });

export type LoadedRepertoire = {
    side: Color;
    /** Every line of every game (chapter) in the file */
    lines: Line[];
    /** By position (fenKey) */
    cards: Map<string, Card>;
};

export async function loadRepertoire(
    repertoire: Repertoire,
): Promise<LoadedRepertoire> {
    const [text, cards] = await Promise.all([
        readDataFile(repertoire.filePath),
        invoke<Card[]>("repertoire_cards", { filePath: repertoire.filePath }),
    ]);
    const lines = parsePgn(text)
        .map(makeGameInternal)
        .flatMap((game) => extractLines(game, repertoire.side));
    return {
        side: repertoire.side,
        lines,
        cards: new Map(cards.map((c) => [c.fen, c])),
    };
}
