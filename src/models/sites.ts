// Chess sites in a Plybook window (I.5): the sites offered, the user's bookmarks, and what
// copied text is offered for the Library. Pure, for tests; the window is src-tauri/src/sites.rs.

import { parsePasted } from "../paste/pasted";

export type Site = {
    label: string;
    url: string;
    /** What it is good for here, in a line */
    note: string;
};

/** The sites offered; Chessable first, by the owner's request */
export const SITES: Site[] = [
    {
        label: "Chessable",
        url: "https://www.chessable.com/",
        note: "Your courses. A course you made yourself can be exported (its export button): the PGN goes to the Library.",
    },
    {
        label: "chess.com",
        url: "https://www.chess.com/",
        note: "Games and analysis: copy a game's PGN (Share → PGN) and add it to the Library.",
    },
    {
        label: "Lichess",
        url: "https://lichess.org/",
        note: "Studies and games: their PGN downloads go to the Library.",
    },
];

/** A bookmark the user added: an https page */
export type Bookmark = { label: string; url: string };

/** The bookmark for a typed address, or why it cannot be one */
export function makeBookmark(
    label: string,
    address: string,
): Bookmark | string {
    let url: URL;
    try {
        url = new URL(
            /^[a-z]+:\/\//i.test(address.trim())
                ? address.trim()
                : `https://${address.trim()}`,
        );
    } catch {
        return "Not a web address";
    }
    if (url.protocol !== "https:") return "Only https pages can be opened";
    return { label: label.trim() || url.hostname, url: url.toString() };
}

/** What a copied text holds that the Library can take: games or a position */
export type Clip =
    | { kind: "pgn"; pgn: string; games: number }
    | { kind: "fen"; fen: string };

/** A copied text worth offering, or undefined (not chess, or a link: those are pasted) */
export function clipOf(text: string | undefined | null): Clip | undefined {
    const pasted = text ? parsePasted(text) : undefined;
    if (pasted?.kind === "pgn") return pasted;
    if (pasted?.kind === "fen") return pasted;
    return undefined;
}

/** A clip as a PGN file's text: a position becomes a game that starts there */
export function clipPgn(clip: Clip): string {
    if (clip.kind === "pgn") {
        const pgn = clip.pgn.trim();
        // a bare move list gets the tag other programs expect before the moves
        return /^\[/.test(pgn)
            ? `${pgn}\n`
            : `[Event "Copied moves"]\n\n${pgn}\n`;
    }
    return `[Event "Copied position"]\n[SetUp "1"]\n[FEN "${clip.fen}"]\n\n*\n`;
}

/** "2026-10-29 14.05 copied.pgn": a file name for a clip, by when it was taken */
export function clipName(clip: Clip, when: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())} ${pad(when.getHours())}.${pad(when.getMinutes())}.${pad(when.getSeconds())}`;
    return `${stamp} ${clip.kind === "fen" ? "position" : clip.games > 1 ? `${clip.games} games` : "game"}.pgn`;
}
