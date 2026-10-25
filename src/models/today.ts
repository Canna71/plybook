// The Today page (UX overhaul, step 3): recently opened files, the greeting, and the
// first-start checklist. No DOM or Tauri here, for tests.

/** A file opened lately: a game/study, or a PDF book. */
export type RecentFile = {
    path: string;
    kind: "game" | "book";
    /** When it was opened (ms since 1970) */
    at: number;
};

export const RECENT_MAX = 8;

/** `list` with `path` moved (or added) to the front, newest first, at most RECENT_MAX. */
export function addRecent(
    list: RecentFile[],
    path: string,
    kind: RecentFile["kind"],
    now: number,
): RecentFile[] {
    return [
        { path, kind, at: now },
        ...list.filter((f) => f.path !== path),
    ].slice(0, RECENT_MAX);
}

export function greeting(hour: number): string {
    if (hour < 5) return "Good night";
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
}

/** "just now", "5 minutes ago", "yesterday", "3 days ago", or the date. */
export function ago(at: number, now: number): string {
    const minutes = Math.round((now - at) / 60_000);
    if (minutes < 2) return "just now";
    if (minutes < 60) return `${minutes} minutes ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return hours === 1 ? "an hour ago" : `${hours} hours ago`;
    const days = Math.round(hours / 24);
    if (days === 1) return "yesterday";
    if (days < 7) return `${days} days ago`;
    return new Date(at).toLocaleDateString();
}

/** What the first-start checklist needs to know. */
export type SetupState = {
    engines: number;
    accounts: number;
    lichessPuzzles: number;
    repertoires: number;
    books: number;
};

export type SetupStep = {
    id: keyof SetupState;
    label: string;
    why: string;
    route: string;
    done: boolean;
};

/** The first-start steps, in a sensible order, each with whether it's done. */
export function setupSteps(s: SetupState): SetupStep[] {
    return [
        {
            id: "engines",
            label: "Add a chess engine",
            why: "Stockfish or Lc0, for analysis, game review and playing.",
            route: "/settings",
            done: s.engines > 0,
        },
        {
            id: "accounts",
            label: "Link your chess.com or Lichess account",
            why: "Your games come into the Library, ready to review.",
            route: "/settings",
            done: s.accounts > 0,
        },
        {
            id: "lichessPuzzles",
            label: "Download the Lichess puzzles",
            why: "Millions of tactics, picked at your rating.",
            route: "/puzzles",
            done: s.lichessPuzzles > 0,
        },
        {
            id: "repertoires",
            label: "Make an opening repertoire",
            why: "Drill your lines with spaced repetition.",
            route: "/repertoires",
            done: s.repertoires > 0,
        },
        {
            id: "books",
            label: "Add a chess book (PDF)",
            why: "Read it here, with every diagram clickable.",
            route: "/library?path=Library",
            done: s.books > 0,
        },
    ];
}
