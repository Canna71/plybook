import { describe, expect, it } from "vitest";
import {
    formatTime,
    parseTime,
    parseYouTube,
    videoLink,
    YOUTUBE_URL,
} from "./youtube";

const ID = "dQw4w9WgXcQ";

describe("parseYouTube", () => {
    it("reads the usual kinds of link, with their start time", () => {
        expect(parseYouTube(`https://www.youtube.com/watch?v=${ID}`)).toEqual({
            id: ID,
            start: 0,
        });
        expect(parseYouTube(`https://youtu.be/${ID}?t=123`)).toEqual({
            id: ID,
            start: 123,
        });
        expect(
            parseYouTube(`https://www.youtube.com/watch?v=${ID}&t=1h2m3s`),
        ).toEqual({ id: ID, start: 3723 });
        expect(parseYouTube(`https://m.youtube.com/shorts/${ID}`)?.id).toBe(ID);
        expect(
            parseYouTube(
                `https://www.youtube-nocookie.com/embed/${ID}?start=90`,
            ),
        ).toEqual({ id: ID, start: 90 });
    });

    it("reads links in HTML-escaped comments", () => {
        expect(
            parseYouTube(`https://www.youtube.com/watch?v=${ID}&amp;t=75s`),
        ).toEqual({ id: ID, start: 75 });
    });

    it("refuses what isn't a YouTube video", () => {
        expect(parseYouTube("https://vimeo.com/123")).toBeUndefined();
        expect(parseYouTube("https://youtu.be/short")).toBeUndefined();
        expect(parseYouTube("not a link")).toBeUndefined();
        expect(
            parseYouTube(`https://evil.example/watch?v=${ID}`),
        ).toBeUndefined();
    });

    it("finds links in comment text", () => {
        const text = `Great idea, see https://youtu.be/${ID}?t=60 and more.`;
        expect(text.match(YOUTUBE_URL)).toEqual([
            `https://youtu.be/${ID}?t=60`,
        ]);
    });
});

describe("links and times", () => {
    it("writes short links", () => {
        expect(videoLink({ id: ID, start: 123 })).toBe(
            `https://youtu.be/${ID}?t=123`,
        );
        expect(videoLink({ id: ID, start: 0 })).toBe(`https://youtu.be/${ID}`);
    });

    it("formats and parses times", () => {
        expect(formatTime(123)).toBe("2:03");
        expect(formatTime(3723)).toBe("1:02:03");
        expect(parseTime("2:03")).toBe(123);
        expect(parseTime("1:02:03")).toBe(3723);
        expect(parseTime("90")).toBe(90);
        expect(parseTime("")).toBe(0);
        expect(parseTime("2m")).toBeUndefined();
    });
});
