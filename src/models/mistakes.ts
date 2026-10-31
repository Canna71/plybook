// "Find the better move" puzzles built from the mistakes of a reviewed game.

import { Color } from "chessops";
import { MoveClass, ReviewedMove } from "./review";

export type GameInfo = {
    white?: string;
    black?: string;
    date?: string;
    /** URL of the original game, when it came from a site */
    site?: string;
};

export type MistakePuzzle = {
    /** File name without extension */
    name: string;
    pgn: string;
    /** Base weight for the puzzle scheduler: blunders come back more often */
    weight: number;
};

const WEIGHTS: Partial<Record<MoveClass, number>> = {
    mistake: 300,
    blunder: 400,
};

/** Which side the user played: a name matching one of theirs (accounts, "Player"). */
export function playerSide(
    info: GameInfo,
    myNames: string[],
): Color | undefined {
    const mine = new Set(myNames.map((n) => n.toLowerCase()));
    if (info.white && mine.has(info.white.toLowerCase())) return "white";
    if (info.black && mine.has(info.black.toLowerCase())) return "black";
}

/** Mistakes and blunders of `color` that have a known better move. */
export const trainableMistakes = (moves: ReviewedMove[], color: Color) =>
    moves.filter(
        (m) =>
            m.color === color &&
            WEIGHTS[m.class] !== undefined &&
            m.bestSan &&
            m.bestSan !== m.san &&
            m.fenBefore,
    );

const moveNumber = (m: ReviewedMove) =>
    `${m.fenBefore!.split(" ")[5] ?? Math.ceil(m.ply / 2)}${m.color === "white" ? "." : "..."}`;

const header = (name: string, value: string) =>
    `[${name} "${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"]`;

const fileSafe = (text: string) =>
    text
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, " ")
        .trim();

export function mistakePuzzles(
    moves: ReviewedMove[],
    info: GameInfo,
    color: Color,
): MistakePuzzle[] {
    const white = info.white || "White";
    const black = info.black || "Black";
    return trainableMistakes(moves, color).map((m) => {
        const number = moveNumber(m);
        const played = `${number} ${m.san}`;
        const headers = [
            header("Event", `Mistake in ${white} vs ${black}`),
            header("Site", info.site ?? "?"),
            header("Date", info.date ?? "????.??.??"),
            header("White", white),
            header("Black", black),
            header("Result", "*"),
            header("SetUp", "1"),
            header("FEN", m.fenBefore!),
            header("Annotator", "Plybook review"),
        ];
        const comment =
            `In the game you played ${played}, which lost ` +
            `${m.loss.toFixed(0)}% winning chances. Find a better move.`;
        return {
            name: fileSafe(`${info.date ?? ""} ${white} vs ${black} ${played}`),
            pgn: `${headers.join("\n")}\n\n{ ${comment} } ${number} ${m.bestSan} *\n`,
            weight: WEIGHTS[m.class]!,
        };
    });
}
