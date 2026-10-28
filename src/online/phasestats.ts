// Accuracy by phase over the user's reviewed online games (P1.6), for Today: the account
// folders' month files are read newest first, the games with evaluations reviewed again
// (models/review.ts, book moves left out as in the review) and split by phase
// (models/phases.ts).

import anylogger from "anylogger";
import { Color } from "chessops";
import { readDataFile } from "../storage/fs";
import { listFolder } from "../storage/library";
import { allBooksLookup } from "../storage/books";
import { BookMove, bookPlies } from "../models/books";
import { makeGame } from "../models/pgn";
import { lineMoves, mainline, reviewLine } from "../models/review";
import {
    GamePhases,
    gamePhases,
    phaseTotals,
    PhaseTotals,
} from "../models/phases";
import {
    accountFolder,
    getAccounts,
    OnlineAccount,
    splitGames,
    tag,
} from "./onlinegames";
const log = anylogger("phasestats");

/** How many of the newest reviewed games count */
export const PHASE_GAMES = 50;

type Reviewed = { date: string; phases: GamePhases };

/** The account's newest reviewed games, up to `limit`, by its player's side */
async function accountGames(
    account: OnlineAccount,
    limit: number,
    books: (fen: string) => Promise<BookMove[]>,
): Promise<Reviewed[]> {
    const name = account.username.toLowerCase();
    let months;
    try {
        months = (await listFolder(await accountFolder(account)))
            .filter((e) => e.kind === "games")
            .sort((a, b) => b.name.localeCompare(a.name));
    } catch {
        return []; // never synced
    }
    const found: Reviewed[] = [];
    for (const month of months) {
        // games are appended as they are played: newest last
        const games = splitGames(await readDataFile(month.path)).reverse();
        for (const text of games) {
            if (found.length >= limit) return found;
            if (!text.includes("[%eval")) continue;
            const color: Color | undefined =
                tag(text, "White")?.toLowerCase() === name
                    ? "white"
                    : tag(text, "Black")?.toLowerCase() === name
                      ? "black"
                      : undefined;
            if (!color) continue;
            try {
                const nodes = mainline(makeGame(text));
                const book = await bookPlies(lineMoves(nodes), books);
                found.push({
                    date: tag(text, "UTCDate") ?? tag(text, "Date") ?? "",
                    phases: gamePhases(reviewLine(nodes, book), color),
                });
            } catch (e) {
                log.warn("could not read a game in", month.path, e);
            }
        }
    }
    return found;
}

/**
 * Accuracy in the opening, middlegame and endgame over the newest `limit` reviewed games of
 * all accounts; undefined when there are none.
 */
export async function recentPhaseAccuracy(
    limit = PHASE_GAMES,
): Promise<{ totals: PhaseTotals; games: number } | undefined> {
    const lookup = await allBooksLookup();
    // the same opening positions come back game after game: look each up once
    const seen = new Map<string, Promise<BookMove[]>>();
    const books = (fen: string) => {
        if (!seen.has(fen)) seen.set(fen, lookup(fen));
        return seen.get(fen)!;
    };
    const all: Reviewed[] = [];
    for (const account of getAccounts())
        all.push(...(await accountGames(account, limit, books)));
    if (!all.length) return undefined;
    const newest = all
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit);
    return {
        totals: phaseTotals(newest.map((g) => g.phases)),
        games: newest.length,
    };
}
