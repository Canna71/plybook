// Played games are stored in the database "history" table, one record per game.

/**
 * The record id of a played game: its Timestamp header (set when the game starts) without
 * separators, so saving after every move keeps updating the same record.
 */
export function historyId(pgn: string): string | undefined {
    const timestamp = pgn.match(/^\[Timestamp "([^"]+)"\]/m)?.[1];
    return timestamp?.replace(/[^0-9A-Za-z]/g, "") || undefined;
}

/** "Player vs maia-1100" for titles. */
export const historyTitle = (white?: string, black?: string) =>
    `${white || "White"} vs ${black || "Black"}`;
