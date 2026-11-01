// YouTube videos attached to positions (I.1): a plain link in a PGN comment, so other chess
// software shows it as a link. Kept free of the DOM for tests.

export type Video = {
    /** The 11-character video id */
    id: string;
    /** Where to start, in seconds */
    start: number;
};

const ID = /^[A-Za-z0-9_-]{11}$/;

/** A YouTube link anywhere in text (also inside HTML-escaped text: "&amp;" is allowed). */
export const YOUTUBE_URL =
    /https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\/[^\s<>"']+/g;

/** "1h2m3s", "2m", "75s" or "75" in seconds. */
function seconds(t: string | null): number {
    if (!t) return 0;
    if (/^\d+$/.test(t)) return +t;
    const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
    return m ? +(m[1] ?? 0) * 3600 + +(m[2] ?? 0) * 60 + +(m[3] ?? 0) : 0;
}

/** The video and start time of a YouTube link (watch, youtu.be, shorts, embed, live). */
export function parseYouTube(link: string): Video | undefined {
    let url: URL;
    try {
        url = new URL(link.replace(/&amp;/g, "&"));
    } catch {
        return undefined;
    }
    const host = url.hostname.replace(/^(www|m)\./, "");
    let id: string | null = null;
    if (host === "youtu.be") {
        id = url.pathname.slice(1);
    } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
        const path = /^\/(?:shorts|embed|live)\/([^/]+)/.exec(url.pathname);
        id = path ? path[1] : url.searchParams.get("v");
    }
    if (!id || !ID.test(id)) return undefined;
    const start = seconds(
        url.searchParams.get("t") ?? url.searchParams.get("start"),
    );
    return { id, start };
}

/** The short link written into comments: "https://youtu.be/ID?t=123". */
export const videoLink = (v: Video) =>
    `https://youtu.be/${v.id}${v.start ? `?t=${v.start}` : ""}`;

/** "2:03", "1:02:03". */
export function formatTime(total: number): string {
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, "0");
    return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/** "2:03", "1:02:03", "123" or "" in seconds; undefined when it isn't a time. */
export function parseTime(text: string): number | undefined {
    const t = text.trim();
    if (!t) return 0;
    const parts = t.split(":");
    if (parts.length > 3 || !parts.every((p) => /^\d+$/.test(p)))
        return undefined;
    return parts.reduce((total, p) => total * 60 + +p, 0);
}
