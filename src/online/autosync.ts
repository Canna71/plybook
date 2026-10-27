// Auto sync and review (P1.4): a little after start, accounts not synced for a while are
// synced in the background, and their newest games are reviewed by the explainer engine
// (engine/backgroundreview.ts): evaluations and ?/?? marks go into the game files, and the
// games are listed on Today with their mistakes.

import anylogger from "anylogger";
import { getSettingValue, setSettingValue } from "../models/settings";
import { readDataFile, writeDataFile } from "../storage/fs";
import { explainerSearch } from "../engine/explainer";
import { reviewGame } from "../engine/backgroundreview";
import { makeToast } from "../components/common/Toast";
import {
    gameKey,
    getAccounts,
    OnlineAccount,
    SITE_LABELS,
    splitGames,
    syncAccount,
} from "./onlinegames";
const log = anylogger("autosync");

/** Sync on start (on by default) */
export const AUTO_SYNC_SETTING = "online.autoSync";
/** The games synced and reviewed lately, newest first, for Today */
export const NEW_GAMES_SETTING = "online.newGames";

/** An account is synced again after this long */
const SYNC_EVERY_HOURS = 6;
/** Games reviewed per start: the newest ones */
const REVIEW_AT_MOST = 5;
/** Games kept in the Today list */
const KEEP = 10;
/** A quick review: enough to find the mistakes that matter */
const REVIEW_SEARCH = { depth: 12, movetime: 300, multipv: 1 };

export type NewGame = {
    /** The month file and the game's index in it */
    path: string;
    index: number;
    white: string;
    black: string;
    result: string;
    date: string;
    /** Your colour in it, if your username is one of the players */
    you?: "white" | "black";
    /** Your mistakes and blunders, once reviewed */
    mistakes?: number;
};

export const newGames = (): NewGame[] => getSettingValue(NEW_GAMES_SETTING, []);

const tag = (game: string, name: string) =>
    game.match(new RegExp(`^\\[${name} "([^"]*)"\\]`, "m"))?.[1] ?? "";

const due = (account: OnlineAccount, now: number) =>
    !account.lastSync ||
    now - Date.parse(account.lastSync) > SYNC_EVERY_HOURS * 3_600_000;

/** Reviews one synced game in its month file and returns its entry for Today. */
async function reviewInFile(
    file: string,
    key: string,
    account: OnlineAccount,
): Promise<NewGame | undefined> {
    const games = splitGames(await readDataFile(file));
    const index = games.findIndex((g) => gameKey(g) === key);
    if (index < 0) return undefined;
    const text = games[index];
    const white = tag(text, "White");
    const black = tag(text, "Black");
    const name = account.username.toLowerCase();
    const you =
        white.toLowerCase() === name
            ? "white"
            : black.toLowerCase() === name
              ? "black"
              : undefined;
    const reviewed = await reviewGame(text, async (fen, history) => {
        const line = (await explainerSearch(fen, { ...REVIEW_SEARCH, history }))
            ?.lines[0];
        return (
            line && { score: line.score, best: line.pv?.[0], depth: line.depth }
        );
    });
    // the file may have changed while reviewing (another sync, the user's notes): read it
    // again and replace just this game
    const now = splitGames(await readDataFile(file));
    const at = now.findIndex((g) => gameKey(g) === key);
    if (at < 0) return undefined;
    now[at] = reviewed.game.pgn().trim();
    await writeDataFile(file, now.join("\n\n") + "\n");
    return {
        path: file,
        index: at,
        white,
        black,
        result: tag(text, "Result"),
        date: tag(text, "UTCDate") || tag(text, "Date"),
        you,
        mistakes: you ? reviewed.mistakes[you] : undefined,
    };
}

/** Syncs the accounts that are due and reviews their newest new games. */
export async function autoSync(): Promise<void> {
    if (!getSettingValue(AUTO_SYNC_SETTING, true)) return;
    const now = Date.now();
    const accounts = getAccounts().filter((a) => due(a, now));
    const fresh: { file: string; key: string; account: OnlineAccount }[] = [];
    for (const account of accounts) {
        try {
            const result = await syncAccount(account);
            if (result.added) {
                makeToast(
                    `${result.added} new ${result.added === 1 ? "game" : "games"} from ${SITE_LABELS[account.site]}: reviewing ${result.added === 1 ? "it" : "them"} in the background`,
                );
            }
            fresh.push(...result.games.map((g) => ({ ...g, account })));
        } catch (e) {
            log.warn("auto sync failed", account.site, account.username, e);
        }
    }
    // the newest games last in each file: review from the end
    const toReview = fresh.slice(-REVIEW_AT_MOST).reverse();
    const reviewed: NewGame[] = [];
    for (const { file, key, account } of toReview) {
        try {
            const entry = await reviewInFile(file, key, account);
            if (entry) reviewed.push(entry);
        } catch (e) {
            log.warn("background review failed", file, e);
        }
    }
    if (!reviewed.length) return;
    await setSettingValue(
        NEW_GAMES_SETTING,
        [...reviewed, ...newGames()].slice(0, KEEP),
    );
    const mistakes = reviewed.reduce((n, g) => n + (g.mistakes ?? 0), 0);
    makeToast(
        `Reviewed ${reviewed.length} new ${reviewed.length === 1 ? "game" : "games"}${
            mistakes
                ? `: ${mistakes} ${mistakes === 1 ? "mistake" : "mistakes"} to look at on Today`
                : ""
        }`,
    );
}

/** Runs autoSync a little after start, so it does not slow the first screen. */
export function scheduleAutoSync(delay = 15_000) {
    setTimeout(() => {
        autoSync().catch((e) => log.warn("auto sync", e));
    }, delay);
}
