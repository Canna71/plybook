// P2.8: how well do the move-reason detectors agree with the themes Lichess tags its puzzles
// with? For each puzzle, the opponent's first move sets it up; after each of the solver's moves
// we ask the detectors what the move created against the opponent, and compare with the tags.
// Run: PUZZLES_CSV=path/to/lichess_db_puzzle.csv pnpm eval:reasons

import { existsSync, readFileSync } from "fs";
import { it } from "vitest";
import { Chess, NormalMove, parseUci } from "chessops";
import { makeFen, parseFen } from "chessops/fen";
import { makeSan, parseSan } from "chessops/san";
import { parsePgn, startingPosition } from "chessops/pgn";
import { makeUci } from "chessops";
import { positionalReasons } from "./positional";
import { factsFromFen } from "../models/facts";
import { lineMotifs, mainReasons, Motif } from "./motifs";
import {
    createdThreat,
    describeIdea,
    isThreat,
    lineIdea,
    playUci,
} from "./threats";
import { nullMoveFen } from "../models/threat";
import { Uci } from "./uci.eval-helper";
import { parsePieceValues } from "../engine/piecevalues";

const CSV = process.env.PUZZLES_CSV;
const LIMIT = Number(process.env.PUZZLES_LIMIT ?? 20_000);
/** Disagreements to print per theme and kind (missed / extra), to see why */
const EXAMPLES = Number(process.env.EXAMPLES ?? 0);
/** Rank a mate above the motifs on the way to it */
const MATE_FIRST = process.env.MATE_FIRST !== "0";

type Puzzle = { id: string; fen: string; moves: string[]; themes: Set<string> };

function readPuzzles(path: string): Puzzle[] {
    return readFileSync(path, "utf8")
        .trim()
        .split("\n")
        .slice(1, LIMIT + 1)
        .map((line) => {
            const [id, fen, moves, , , , , themes] = line.split(",");
            return {
                id,
                fen,
                moves: moves.split(" "),
                themes: new Set(themes.split(" ")),
            };
        });
}

/** The themes a detector set finds in a puzzle's solution. */
type Detector = (puzzle: Puzzle) => Set<string>;

/** Today's facts (facts.ts): a fork or a pin the solver's move created. */
const factsDetector: Detector = (puzzle) => {
    const found = new Set<string>();
    const pos = Chess.fromSetup(parseFen(puzzle.fen).unwrap()).unwrap();
    const victim = pos.turn; // the side that blundered, and that the solver attacks
    let before = factsFromFen(makeFen(pos.toSetup()));
    puzzle.moves.forEach((uci, i) => {
        pos.play(parseUci(uci)!);
        const after = factsFromFen(makeFen(pos.toSetup()));
        if (i % 2 === 1) {
            const keys = new Set(before.map((f) => f.key));
            for (const f of after) {
                if (keys.has(f.key) || f.victim !== victim) continue;
                if (f.kind === "fork") found.add("fork");
                if (f.kind === "pinned" && !f.minor) found.add("pin");
            }
        }
        before = after;
    });
    // a mate is the point of a line: a checking "fork" on the way is not
    if (MATE_FIRST && pos.isCheckmate()) found.delete("fork");
    return found;
};

/** The motif detectors (motifs.ts) after ranking, from the position the solver faces. */
const motifDetector: Detector = (puzzle) => {
    const pos = Chess.fromSetup(parseFen(puzzle.fen).unwrap()).unwrap();
    const setUp = parseUci(puzzle.moves[0])! as NormalMove;
    // the opponent's move took something there: taking back is not a free piece
    const captured = pos.board.has(setUp.to);
    pos.play(setUp);
    const reasons = lineMotifs(
        makeFen(pos.toSetup()),
        puzzle.moves.slice(1),
        captured ? puzzle.moves[0].slice(2, 4) : undefined,
    );
    return new Set(mainReasons(reasons).map((r) => r.motif));
};

const MOTIFS: Motif[] = [
    "mate",
    "backRankMate",
    "smotheredMate",
    "doubleCheck",
    "fork",
    "pin",
    "skewer",
    "discoveredAttack",
    "hangingPiece",
    "promotion",
];

type Score = { tp: number; fp: number; fn: number };

function measure(puzzles: Puzzle[], detect: Detector, themes: string[]) {
    const scores = Object.fromEntries(
        themes.map((t) => [t, { tp: 0, fp: 0, fn: 0 } as Score]),
    );
    const examples: string[] = [];
    const show = (kind: string, t: string, s: number, p: Puzzle) => {
        if (s <= EXAMPLES)
            examples.push(
                `${kind} ${t}: https://lichess.org/training/${p.id}  [${[...p.themes].join(" ")}]`,
            );
    };
    for (const p of puzzles) {
        const found = detect(p);
        for (const t of themes) {
            const s = scores[t];
            if (found.has(t) && p.themes.has(t)) s.tp++;
            else if (found.has(t)) show("extra", t, ++s.fp, p);
            else if (p.themes.has(t)) show("missed", t, ++s.fn, p);
        }
    }
    if (examples.length) console.log(examples.join("\n"));
    return Object.entries(scores).map(([theme, s]) => ({
        theme,
        tagged: s.tp + s.fn,
        precision: (s.tp / Math.max(1, s.tp + s.fp)).toFixed(2),
        recall: (s.tp / Math.max(1, s.tp + s.fn)).toFixed(2),
    }));
}

/** One puzzle in detail: its position, line, tags and what the detectors found. */
function inspect(p: Puzzle) {
    const pos = Chess.fromSetup(parseFen(p.fen).unwrap()).unwrap();
    pos.play(parseUci(p.moves[0])!);
    const fen = makeFen(pos.toSetup());
    const sans = p.moves.slice(1).map((uci) => {
        const move = parseUci(uci)!;
        const san = makeSan(pos, move);
        pos.play(move);
        return san;
    });
    console.log(
        [
            `https://lichess.org/training/${p.id}`,
            fen,
            sans.join(" "),
            `tags: ${[...p.themes].join(" ")}`,
            `found: ${JSON.stringify(lineMotifs(fen, p.moves.slice(1)))}`,
        ].join("\n"),
    );
}

const PGN_FILE = process.env.PGN_FILE;

/**
 * R3 check by hand: an annotated game (PGN_FILE), each main-line move with the annotator's
 * comment next to the positional reasons found for it. No tags exist for positional ideas.
 * With STOCKFISH, its piece values are used too.
 */
it.skipIf(!PGN_FILE || !existsSync(PGN_FILE ?? ""))(
    "positional, by hand",
    async () => {
        const engine = process.env.STOCKFISH
            ? new Uci(process.env.STOCKFISH)
            : undefined;
        await engine?.init();
        const valuesAt = async (fen: string) =>
            engine && parsePieceValues(await engine.evalLines(fen));
        for (const game of parsePgn(readFileSync(PGN_FILE!, "utf8"))) {
            const pos = startingPosition(game.headers).unwrap();
            for (const node of game.moves.mainline()) {
                const move = parseSan(pos, node.san);
                if (!move) break;
                const fen = makeFen(pos.toSetup());
                const after = pos.clone();
                after.play(move);
                const reasons = positionalReasons(fen, makeUci(move), {
                    before: await valuesAt(fen),
                    after: await valuesAt(makeFen(after.toSetup())),
                });
                const comment = (node.comments ?? [])
                    .join(" ")
                    .replace(/\[%[^\]]*\]|%EMPTY%/g, "")
                    .replace(/\s+/g, " ")
                    .trim();
                if (reasons.length || comment)
                    console.log(
                        `${pos.fullmoves}${pos.turn === "white" ? "." : "..."} ${node.san}: ${reasons.map((r) => (r.good ? "+ " : "- ") + r.text).join("; ") || "-"}${comment ? `\n      book: ${comment.slice(0, 160)}` : ""}`,
                    );
                pos.play(move);
            }
        }
        engine?.quit();
    },
);

const STOCKFISH = process.env.STOCKFISH;
const THREATS = Number(process.env.THREATS ?? 0);

/**
 * R2 spot check with a real engine: for the first THREATS puzzles, what the blunder failed to
 * stop (the solver's threat before it) and what the solver's first move threatens next. No
 * tags exist for these, so the sentences are printed for checking by hand.
 */
it.skipIf(!CSV || !STOCKFISH || !THREATS)("threats, by hand", async () => {
    const engine = new Uci(STOCKFISH!);
    await engine.init();
    for (const p of readPuzzles(CSV!).slice(0, THREATS)) {
        const pos = Chess.fromSetup(parseFen(p.fen).unwrap()).unwrap();
        const fenBefore = makeFen(pos.toSetup()); // the opponent, about to blunder
        const blunder = parseUci(p.moves[0])!;
        const blunderSan = makeSan(pos, blunder);
        pos.play(blunder);
        const fenAfter = makeFen(pos.toSetup()); // the solver to move
        const first = makeSan(pos, parseUci(p.moves[1])!);

        // the solver's threat before the blunder, and whether the blunder stopped it
        const passedBefore = nullMoveFen(fenBefore);
        const threatBefore = passedBefore
            ? lineIdea(passedBefore, await engine.pv(passedBefore, 12))
            : undefined;
        // the solver's first move, and what it threatens if the opponent passed
        const afterFirst = playUci(fenAfter, p.moves[1]);
        const passedAfter = afterFirst && nullMoveFen(afterFirst);
        const ourPv = passedAfter ? await engine.pv(passedAfter, 12) : [];
        const created = createdThreat(fenAfter, p.moves[1], ourPv);
        console.log(
            [
                `https://lichess.org/training/${p.id}  [${[...p.themes].join(" ")}]`,
                `  before ${blunderSan}, the threat was: ${isThreat(threatBefore) ? describeIdea(threatBefore) : "none"}`,
                `  ${first} threatens: ${created ? describeIdea(created) : "nothing more"}`,
            ].join("\n"),
        );
    }
    engine.quit();
});

it.skipIf(!CSV || !existsSync(CSV))("detectors vs Lichess themes", () => {
    const puzzles = readPuzzles(CSV!);
    const one = process.env.PUZZLE;
    if (one) {
        for (const id of one.split(","))
            inspect(puzzles.find((p) => p.id === id)!);
        return;
    }
    console.log(`${puzzles.length} puzzles`);
    console.log("baseline: facts.ts");
    console.table(measure(puzzles, factsDetector, ["fork", "pin"]));
    console.log("motifs.ts, ranked");
    console.table(measure(puzzles, motifDetector, MOTIFS));
});
