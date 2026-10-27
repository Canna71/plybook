import { invoke } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { BaseDirectory, exists, mkdir, readDir } from "@tauri-apps/plugin-fs";
import anylogger from "anylogger";
import { getSettingValue, setSettingValue } from "../models/settings";
import { readDataFile, writeDataFile } from "../storage/fs";
const log = anylogger("onlinegames");

// Mirrors Site in src-tauri/src/net.rs
export type OnlineSite = "chesscom" | "lichess";

export type OnlineAccount = {
    site: OnlineSite;
    username: string;
    /** ISO time of the last successful sync */
    lastSync?: string;
};

export const SITE_LABELS: Record<OnlineSite, string> = {
    chesscom: "chess.com",
    lichess: "Lichess",
};

const ACCOUNTS_KEY = "online.accounts";
const MONTH_FILE = /^(\d{4}-\d{2})\.pgn$/;

export const getAccounts = (): OnlineAccount[] =>
    getSettingValue(ACCOUNTS_KEY, []);

const sameAccount = (a: OnlineAccount, b: OnlineAccount) =>
    a.site === b.site && a.username === b.username;

export async function addAccount(site: OnlineSite, username: string) {
    const account = { site, username: username.trim().toLowerCase() };
    if (getAccounts().some((a) => sameAccount(a, account))) return account;
    await setSettingValue(ACCOUNTS_KEY, [...getAccounts(), account]);
    return account;
}

/** Forgets the account; the downloaded games stay in the Library. */
export async function removeAccount(account: OnlineAccount) {
    await setSettingValue(
        ACCOUNTS_KEY,
        getAccounts().filter((a) => !sameAccount(a, account)),
    );
}

/** Library-relative folder holding one PGN file per month. */
export const accountFolder = (account: OnlineAccount) =>
    join("Library", "Online", SITE_LABELS[account.site], account.username);

/** Splits a multi-game PGN; every game starts with a tag line after a blank line. */
export function splitGames(pgn: string) {
    return pgn
        .split(/\r?\n\s*\r?\n(?=\[)/)
        .map((game) => game.trim())
        .filter(Boolean);
}

const tag = (game: string, name: string) =>
    game.match(new RegExp(`^\\[${name} "([^"]*)"\\]`, "m"))?.[1];

/** "2024.03.29" -> "2024-03", from the UTC date both sites write. */
export const gameMonth = (game: string) =>
    (tag(game, "UTCDate") ?? tag(game, "Date"))?.slice(0, 7).replace(".", "-");

/** chess.com puts the game URL in Link, Lichess in Site. */
export const gameKey = (game: string) =>
    tag(game, "Link") ??
    tag(game, "GameId") ??
    [
        tag(game, "Site"),
        tag(game, "White"),
        tag(game, "Black"),
        tag(game, "UTCDate"),
        tag(game, "UTCTime"),
    ].join("|");

const gameTime = (game: string) =>
    `${tag(game, "UTCDate") ?? ""} ${tag(game, "UTCTime") ?? ""}`;

async function monthFiles(folder: string) {
    return (await readDir(folder, { baseDir: BaseDirectory.AppLocalData }))
        .map((entry) => (entry.isFile ? MONTH_FILE.exec(entry.name)?.[1] : ""))
        .filter((month): month is string => !!month)
        .sort();
}

export type SyncResult = {
    added: number;
    months: number;
    /** The new games: the month file they went to and their key there (gameKey) */
    games: { file: string; key: string }[];
};

/**
 * Downloads the games since the latest month already on disk. Games already in a month file
 * are kept as they are, so notes added in ReChess survive a sync.
 */
export async function syncAccount(account: OnlineAccount): Promise<SyncResult> {
    const folder = await accountFolder(account);
    await mkdir(folder, {
        baseDir: BaseDirectory.AppLocalData,
        recursive: true,
    });
    const sinceMonth = (await monthFiles(folder)).at(-1);

    const pgn = await invoke<string>("online_fetch_games", {
        site: account.site,
        username: account.username,
        sinceMonth,
    });

    const byMonth = new Map<string, string[]>();
    for (const game of splitGames(pgn)) {
        const month = gameMonth(game);
        if (!month || (sinceMonth && month < sinceMonth)) continue;
        byMonth.set(month, [...(byMonth.get(month) ?? []), game]);
    }

    let added = 0;
    const newGames: SyncResult["games"] = [];
    for (const [month, games] of byMonth) {
        const file = await join(folder, `${month}.pgn`);
        const existing = (await exists(file, {
            baseDir: BaseDirectory.AppLocalData,
        }))
            ? splitGames(await readDataFile(file))
            : [];
        const known = new Set(existing.map(gameKey));
        const fresh = games
            .filter((game) => !known.has(gameKey(game)))
            .sort((a, b) => gameTime(a).localeCompare(gameTime(b)));
        if (fresh.length === 0) continue;
        await writeDataFile(file, [...existing, ...fresh].join("\n\n") + "\n");
        added += fresh.length;
        newGames.push(...fresh.map((game) => ({ file, key: gameKey(game) })));
    }

    log.info(
        `synced ${SITE_LABELS[account.site]} ${account.username}: ${added} new games`,
    );
    await setSettingValue(
        ACCOUNTS_KEY,
        getAccounts().map((a) =>
            sameAccount(a, account)
                ? { ...a, lastSync: new Date().toISOString() }
                : a,
        ),
    );
    return { added, months: byMonth.size, games: newGames };
}
