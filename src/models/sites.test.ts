import { describe, expect, it } from "vitest";
import { clipName, clipOf, clipPgn, makeBookmark, SITES } from "./sites";

describe("chess sites", () => {
    it("starts with Chessable, and every site is an https page", () => {
        expect(SITES[0].label).toBe("Chessable");
        for (const s of SITES) expect(s.url.startsWith("https://")).toBe(true);
    });

    it("makes a bookmark from a typed address, https only", () => {
        expect(makeBookmark("", "chesstempo.com")).toEqual({
            label: "chesstempo.com",
            url: "https://chesstempo.com/",
        });
        expect(makeBookmark("Tempo", "https://chesstempo.com/x")).toEqual({
            label: "Tempo",
            url: "https://chesstempo.com/x",
        });
        expect(makeBookmark("", "http://example.com")).toMatch(/https/);
        expect(makeBookmark("", "file:///etc/passwd")).toMatch(/https/);
        expect(makeBookmark("", "")).toBe("Not a web address");
    });
});

describe("what a copy offers", () => {
    it("a move list or a PGN is a game; a FEN a position", () => {
        expect(clipOf("1. e4 e5 2. Nf3 Nc6 3. Bb5")).toMatchObject({
            kind: "pgn",
            games: 1,
        });
        expect(
            clipOf(
                "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
            )?.kind,
        ).toBe("fen");
    });

    it("anything else is not offered, nor a Lichess link (pasting opens those)", () => {
        expect(clipOf("hello")).toBeUndefined();
        expect(clipOf("")).toBeUndefined();
        expect(clipOf(undefined)).toBeUndefined();
        expect(clipOf("https://lichess.org/abcdefgh")).toBeUndefined();
    });

    it("a bare move list gets a tag; a PGN with tags is kept as it is", () => {
        expect(clipPgn({ kind: "pgn", pgn: "1. e4 e5", games: 1 })).toBe(
            '[Event "Copied moves"]\n\n1. e4 e5\n',
        );
        const tagged = '[Event "Club"]\n\n1. d4 *';
        expect(clipPgn({ kind: "pgn", pgn: tagged, games: 1 })).toBe(
            `${tagged}\n`,
        );
    });

    it("a position becomes a game that starts there", () => {
        const fen = "8/8/8/8/8/8/8/K6k w - - 0 1";
        const pgn = clipPgn({ kind: "fen", fen });
        expect(pgn).toContain(`[FEN "${fen}"]`);
        expect(pgn).toContain('[SetUp "1"]');
    });

    it("names a clip by when it was copied", () => {
        const when = new Date(2026, 9, 29, 14, 5, 9);
        expect(clipName({ kind: "pgn", pgn: "", games: 2 }, when)).toBe(
            "2026-10-29 14.05.09 2 games.pgn",
        );
        expect(clipName({ kind: "fen", fen: "" }, when)).toBe(
            "2026-10-29 14.05.09 position.pgn",
        );
    });
});
