import { describe, expect, it } from "vitest";
import { parsePgn } from "chessops/pgn";
import {
    chessableToPgn,
    commentText,
    drawingCommands,
    isChessableLesson,
} from "./chessable";
import { parsePasted } from "./pasted";

// a made-up lesson in the shape a lesson page loads (not a course's content)
const comment = (...vals: string[]) =>
    JSON.stringify({ data: vals.map((val) => ({ key: "C", state: "", val })) });

const ODDS = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/1NBQKBNR w Kkq - 0 1";

const lesson = (moves: object[]) =>
    JSON.stringify({
        lesson: {
            moves: moves.map((m) => ({
                opening_name: "Game 9:  Test - Sample ",
                book_name: "My Course",
                chapterTitle: "1. Openings",
                oid: 7,
                ...m,
            })),
            authors: { "7": { name: "Author" } },
        },
    });

const SAMPLE = lesson([
    {
        move_fen: ODDS,
        move_white: "e4",
        move_black: "e5",
        comment_before_white: comment(
            "<strong>Intro</strong> <br/><br/> Odds.",
        ),
        comment_white: comment("Opens the @@SANStart@@Bf1@@SANEnd@@ ."),
    },
    {
        move_white: "Nf3",
        move_black: "Nc6",
        drawing_white: [
            { object: "circle", start: "e5", color: "r" },
            { object: "arrow", start: "f3", end: "e5", color: "g" },
        ],
    },
    { move_white: "Bc4", move_black: "Nd4", annotation_black: 2 },
    { move_white: "Nxe5", move_black: "Qg5", annotation_white: 1 },
    { move_white: "Nxf7", move_black: "Qxg2" },
    { move_white: "Rf1", move_black: "Qxe4+" },
    { move_white: "Be2", move_black: null, result: "0-1" },
]);

describe("chessable lessons", () => {
    it("recognises a lesson's JSON only", () => {
        expect(isChessableLesson(SAMPLE)).toBe(true);
        expect(isChessableLesson('{"moves": []}')).toBe(false);
        expect(isChessableLesson("1. e4 e5")).toBe(false);
    });

    it("cleans comments: SAN markers, tags, entities, braces", () => {
        expect(
            commentText(
                comment(
                    "A @@SANStart@@Nf6@@SANEnd@@+ <b>x</b> &amp; {y}",
                    "f7",
                    ".",
                ),
            ),
        ).toBe("A Nf6+ x & y f7.");
        expect(commentText("")).toBe("");
        expect(commentText("not json")).toBe("");
    });

    it("turns drawings into PGN commands", () => {
        expect(
            drawingCommands([
                { object: "circle", start: "f7", color: "b" },
                { object: "arrow", start: "c4", end: "d5", color: "r" },
                { object: "arrow", start: "c4", end: "zz", color: "r" },
            ]),
        ).toBe("[%csl Bf7][%cal Rc4d5]");
        expect(drawingCommands(null)).toBe("");
    });

    it("converts a lesson with its start, comments, drawings and result", () => {
        const out = chessableToPgn(SAMPLE);
        if (typeof out === "string") throw new Error(out);
        expect(out.stoppedAt).toBeUndefined();
        expect(out.pgn).toContain('[Event "Game 9: Test - Sample"]');
        expect(out.pgn).toContain('[Annotator "Author"]');
        expect(out.pgn).toContain('[Source "My Course, 1. Openings"]');
        expect(out.pgn).toContain(`[FEN "${ODDS}"]`);
        expect(out.pgn).toContain('[Result "0-1"]');
        expect(out.pgn).toContain(
            "{ Intro Odds. } 1. e4 { Opens the Bf1. } 1... e5",
        );
        expect(out.pgn).toContain("2. Nf3 { [%csl Re5][%cal Gf3e5] } 2... Nc6");
        expect(out.pgn).toContain("3. Bc4 Nd4 $2 4. Nxe5 $1 Qg5");
        expect(out.pgn).toMatch(/7\. Be2 0-1\n$/);

        const games = parsePgn(out.pgn);
        expect(games).toHaveLength(1);
        let moves = 0;
        for (let n = games[0].moves; n.children.length; n = n.children[0])
            moves++;
        expect(moves).toBe(13);
    });

    it("stops at the first move that is not legal", () => {
        const out = chessableToPgn(
            lesson([
                { move_white: "e4", move_black: "e5" },
                { move_white: "Nf3", move_black: "Ke6" },
                { move_white: "Nxe5", move_black: "d6", result: "1-0" },
            ]),
        );
        if (typeof out === "string") throw new Error(out);
        expect(out.stoppedAt).toBe("2... Ke6");
        expect(out.pgn).not.toContain('[FEN "');
        expect(out.pgn).toMatch(/2\. Nf3 \*\n$/);
    });

    it("faces the board to the side the course is studied from", () => {
        const studied = (where: object) => {
            const out = chessableToPgn(
                JSON.stringify({
                    ...where,
                    lesson: {
                        ...("lesson" in where ? (where.lesson as object) : {}),
                        moves: [
                            {
                                move_white: "e4",
                                move_black: "e5",
                                ...("move" in where
                                    ? (where.move as object)
                                    : {}),
                            },
                        ],
                    },
                }),
            );
            if (typeof out === "string") throw new Error(out);
            return parsePgn(out.pgn)[0].headers.get("Orientation");
        };
        expect(studied({ studyCol: "black" })).toBe("black");
        expect(studied({ lesson: { studyCol: "white" } })).toBe("white");
        expect(studied({ move: { studyCol: "black" } })).toBe("black");
        expect(studied({})).toBeUndefined();
    });

    it("rejects what is not a lesson", () => {
        expect(typeof chessableToPgn("{")).toBe("string");
        expect(typeof chessableToPgn('{"lesson": {"moves": []}}')).toBe(
            "string",
        );
    });

    it("is opened as one game when pasted, with a note when cut short", () => {
        expect(parsePasted(SAMPLE)).toMatchObject({
            kind: "pgn",
            games: 1,
            note: undefined,
        });
        const short = parsePasted(
            lesson([{ move_white: "e4", move_black: "e4" }]),
        );
        expect(short).toMatchObject({ kind: "pgn", games: 1 });
        expect(short?.kind === "pgn" && short.note).toContain("1... e4");
    });
});
