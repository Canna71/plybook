// A Chessable lesson as PGN: the JSON a lesson page loads ({"lesson": {"moves": [...]}}), pasted
// by the user, becomes one game with its comments, arrows, circles and annotations. A converter
// of what the user pastes: nothing is fetched (the decision on Chessable is in ROADMAP I.5).
// Every move is checked with chessops; the line stops at the first one that is not legal.

import { Chess, parseSquare } from "chessops";
import { INITIAL_FEN, makeFen, parseFen } from "chessops/fen";
import { makeSanAndPlay, parseSan } from "chessops/san";

type ChessableDrawing = {
    object?: string;
    start?: string;
    end?: string;
    color?: string;
};

type ChessableMove = {
    move_white?: string | null;
    move_black?: string | null;
    move_fen?: string;
    comment_white?: string;
    comment_black?: string;
    comment_before_white?: string;
    comment_before_black?: string;
    annotation_white?: number;
    annotation_black?: number;
    drawing_white?: ChessableDrawing[] | null;
    drawing_black?: ChessableDrawing[] | null;
    drawing_initial?: ChessableDrawing[] | null;
    result?: string | null;
    opening_name?: string;
    book_name?: string;
    chapterTitle?: string;
    oid?: number;
};

type ChessableLesson = {
    lesson?: {
        moves?: ChessableMove[];
        authors?: Record<string, { name?: string }>;
    };
};

/** Whether a text looks like a lesson's JSON (cheap: before parsing it) */
export const isChessableLesson = (text: string) =>
    /^\s*\{\s*"lesson"\s*:\s*\{/.test(text) && /"moves"\s*:\s*\[/.test(text);

const ENTITIES: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    "#39": "'",
    nbsp: " ",
};

/** A comment field (itself JSON: {"data": [{"val": "…"}]}) as plain text for a PGN comment */
export function commentText(field: string | null | undefined): string {
    if (!field) return "";
    let data: { val?: unknown }[] = [];
    try {
        data = (JSON.parse(field) as { data?: { val?: unknown }[] }).data ?? [];
    } catch {
        return "";
    }
    return (
        data
            .map((d) => (typeof d.val === "string" ? d.val : ""))
            .join(" ")
            .replace(/@@SANStart@@(.*?)@@SANEnd@@/g, "$1")
            .replace(/<br\s*\/?>/gi, " ")
            .replace(/<[^>]*>/g, "")
            .replace(
                /&(#39|amp|lt|gt|quot|nbsp);/g,
                (_, e: string) => ENTITIES[e],
            )
            // a "}" would end the PGN comment
            .replace(/[{}]/g, "")
            .replace(/\s+/g, " ")
            .replace(/\s+([.,;:!?)])/g, "$1")
            .trim()
    );
}

const COLOURS: Record<string, string> = { r: "R", g: "G", b: "B", y: "Y" };
const square = (s: unknown) =>
    typeof s === "string" && parseSquare(s) !== undefined ? s : undefined;

/** Circles and arrows as PGN commands: "[%csl Rf7][%cal Rc4d5]" */
export function drawingCommands(
    drawings: ChessableDrawing[] | null | undefined,
): string {
    const circles: string[] = [];
    const arrows: string[] = [];
    for (const d of drawings ?? []) {
        const colour = COLOURS[d.color ?? ""] ?? "G";
        const start = square(d.start);
        if (!start) continue;
        if (d.object === "circle") circles.push(`${colour}${start}`);
        if (d.object === "arrow" && square(d.end))
            arrows.push(`${colour}${start}${d.end}`);
    }
    return (
        (circles.length ? `[%csl ${circles.join(",")}]` : "") +
        (arrows.length ? `[%cal ${arrows.join(",")}]` : "")
    );
}

const tag = (name: string, value: string) =>
    `[${name} "${value.replace(/[\\"]/g, "").replace(/\s+/g, " ").trim()}"]`;

/** The lesson as PGN, with a note when it stops early; or why it is not a lesson */
export function chessableToPgn(
    text: string,
): { pgn: string; stoppedAt?: string } | string {
    let lesson: ChessableLesson;
    try {
        lesson = JSON.parse(text) as ChessableLesson;
    } catch {
        return "Not a Chessable lesson (not JSON)";
    }
    const moves = lesson.lesson?.moves;
    if (!Array.isArray(moves) || !moves.length)
        return "Not a Chessable lesson (no moves)";
    const first = moves[0];

    // the start: the first entry's position (a game can start with odds or from a diagram)
    const startFen = first.move_fen?.trim() || INITIAL_FEN;
    const setup = parseFen(startFen);
    const start = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    if (!start?.isOk)
        return "Not a Chessable lesson (its first position is not legal)";
    const pos = start.value;
    const fen = makeFen(pos.toSetup());

    const author = first.oid
        ? lesson.lesson?.authors?.[String(first.oid)]?.name
        : undefined;
    const headers = [
        tag(
            "Event",
            first.opening_name || first.chapterTitle || "Chessable lesson",
        ),
        tag("Site", "Chessable"),
        ...(author ? [tag("Annotator", author)] : []),
        ...(first.book_name
            ? [
                  tag(
                      "Source",
                      [first.book_name, first.chapterTitle]
                          .filter(Boolean)
                          .join(", "),
                  ),
              ]
            : []),
    ];
    if (
        fen.split(" ").slice(0, 4).join(" ") !==
        INITIAL_FEN.split(" ").slice(0, 4).join(" ")
    )
        headers.push(tag("SetUp", "1"), tag("FEN", fen));

    const out: string[] = [];
    const initial = drawingCommands(first.drawing_initial);
    if (initial) out.push(`{ ${initial} }`);
    // the move number is needed again after a comment interrupts a white–black pair
    let numberNeeded = true;
    let stoppedAt: string | undefined;
    let result = "*";

    const play = (
        san: string | null | undefined,
        nag: number | undefined,
        before: string | undefined,
        after: string | undefined,
        drawings: ChessableDrawing[] | null | undefined,
    ): boolean => {
        if (!san) return true;
        const beforeText = commentText(before);
        if (beforeText) {
            out.push(`{ ${beforeText} }`);
            numberNeeded = true;
        }
        const move = parseSan(pos, san.replace(/[!?]+$/, ""));
        if (!move) {
            const number = `${pos.fullmoves}${pos.turn === "white" ? "." : "..."}`;
            stoppedAt = `${number} ${san}`;
            return false;
        }
        const number =
            pos.turn === "white"
                ? `${pos.fullmoves}. `
                : numberNeeded
                  ? `${pos.fullmoves}... `
                  : "";
        out.push(
            `${number}${makeSanAndPlay(pos, move)}${nag && nag > 0 ? ` $${nag}` : ""}`,
        );
        numberNeeded = false;
        const comment = [drawingCommands(drawings), commentText(after)]
            .filter(Boolean)
            .join(" ");
        if (comment) {
            out.push(`{ ${comment} }`);
            numberNeeded = true;
        }
        return true;
    };

    for (const m of moves) {
        if (
            !play(
                m.move_white,
                m.annotation_white,
                m.comment_before_white,
                m.comment_white,
                m.drawing_white,
            ) ||
            !play(
                m.move_black,
                m.annotation_black,
                m.comment_before_black,
                m.comment_black,
                m.drawing_black,
            )
        )
            break;
        if (m.result && /^(1-0|0-1|1\/2-1\/2)$/.test(m.result))
            result = m.result;
    }
    if (stoppedAt) result = "*";
    headers.push(tag("Result", result));
    return {
        pgn: `${headers.join("\n")}\n\n${[...out, result].join(" ")}\n`,
        stoppedAt,
    };
}
