// The sections of Settings (UX overhaul, step 8b) and the words that find them. No DOM here,
// for tests.

export type SettingsSection = {
    id: string;
    label: string;
    /** What the section holds, in words a search would use */
    keywords: string;
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
    {
        id: "appearance",
        label: "Appearance",
        keywords: "theme dark light mode board colours pieces style look",
    },
    {
        id: "engines",
        label: "Engines",
        keywords:
            "stockfish lc0 leela maia uci play against opponent analysis strength human moves threads",
    },
    {
        id: "books",
        label: "Opening books",
        keywords: "polyglot bin openings explorer book moves",
    },
    {
        id: "accounts",
        label: "Accounts",
        keywords:
            "lichess chess.com online sync import games username token api",
    },
    {
        id: "backups",
        label: "Backups",
        keywords: "backup restore save copy daily automatic zip data",
    },
    {
        id: "updates",
        label: "Updates",
        keywords: "update upgrade new version release install about",
    },
];

/** Sections whose name or keywords hold every word of the query, best (name) matches first. */
export function findSections(query: string): SettingsSection[] {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return SETTINGS_SECTIONS;
    const matches = (text: string) => words.every((w) => text.includes(w));
    const byName = SETTINGS_SECTIONS.filter((s) =>
        matches(s.label.toLowerCase()),
    );
    const byKeyword = SETTINGS_SECTIONS.filter(
        (s) =>
            !byName.includes(s) &&
            matches(`${s.label} ${s.keywords}`.toLowerCase()),
    );
    return [...byName, ...byKeyword];
}

export const sectionById = (id: string | undefined) =>
    SETTINGS_SECTIONS.find((s) => s.id === id) ?? SETTINGS_SECTIONS[0];
