// P2.8: how well do the move-reason detectors agree with the themes Lichess tags its puzzles
// with? For each puzzle, the opponent's first move sets it up; after each of the solver's moves
// we ask the detectors what the move created against the opponent, and compare with the tags.
// Run: PUZZLES_CSV=path/to/lichess_db_puzzle.csv pnpm eval:reasons

import { existsSync, readFileSync } from "fs";
import { it } from "vitest";
import {
    Chess,
    makeSquare,
    NormalMove,
    opposite,
    parseSquare,
    parseUci,
    SquareSet,
} from "chessops";
import { attacks, pawnAttacks } from "chessops/attacks";
import { makeFen, parseFen } from "chessops/fen";
import { makeSan, parseSan } from "chessops/san";
import { parsePgn, startingPosition } from "chessops/pgn";
import { makeUci } from "chessops";
import { badBishops, colourOf, positionalReasons, space } from "./positional";
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
const BAD_BISHOP = Number(process.env.BAD_BISHOP ?? 0);
const HOLES = Number(process.env.HOLES ?? 0);

/** Winning chances (%) of a centipawn score, as Lichess computes them */
const winChance = (cp: number) =>
    50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);

/**
 * P2.4f check of the hole rule against the engine (HOLES balanced positions): in each position,
 * every quiet pawn move is searched (`searchmoves`); do the moves the rule says leave a hole give
 * away more winning chances than the other pawn moves of the same position? Positions come from
 * real games (GAMES_PGN, e.g. a Lichess database month, CC0), moves 10 and 18: puzzle positions
 * are the moment before a blunder, where most pawn moves lose to a tactic.
 */
const GAMES_PGN = process.env.GAMES_PGN;

/** Positions at moves 10 and 18 of the games in a PGN file (white to move at both) */
function gamePositions(path: string): string[] {
    const fens: string[] = [];
    for (const text of readFileSync(path, "utf8").split(/\n(?=\[Event )/)) {
        const game = parsePgn(text)[0];
        if (!game) continue;
        const pos = startingPosition(game.headers).unwrap();
        let ply = 0;
        for (const node of game.moves.mainline()) {
            const move = parseSan(pos, node.san);
            if (!move) break;
            pos.play(move);
            ply++;
            if (ply === 18 || ply === 34) fens.push(makeFen(pos.toSetup()));
            if (ply > 34) break;
        }
    }
    return fens;
}

const SPACE = Number(process.env.SPACE ?? 0);
const BREAKS = Number(process.env.BREAKS ?? 0);

/** A quiet pawn move in a position from a game: what a rule is asked about */
type PawnMove = { pos: Chess; move: NormalMove; after: Chess };

/**
 * P2.4f comparison of quiet pawn moves against the engine, for a positional idea: in `count`
 * balanced positions from games (GAMES_PGN), every quiet pawn move is searched (`searchmoves`);
 * for each version of a rule, do the moves it picks out give away less winning chances than the
 * other pawn moves of the same position? Prints, per version, how many moves it picks, their
 * mean loss against the rest's, and in how many positions with both they did better.
 */
async function comparePawnMoves(
    count: number,
    versions: (m: PawnMove) => [string, boolean][],
) {
    const engine = new Uci(STOCKFISH!);
    await engine.init();
    const DEPTH = 10;
    const mean = (xs: number[]) =>
        xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    type Split = { picked: number[]; other: number[] };
    const all: Record<string, Split> = {};
    const paired: Record<string, { n: number; better: number }> = {};
    let seen = 0;
    for (const start of gamePositions(GAMES_PGN!)) {
        if (seen >= count) break;
        const pos = Chess.fromSetup(parseFen(start).unwrap()).unwrap();
        const fen = makeFen(pos.toSetup());
        const moves = [...pos.allDests()]
            .filter(([from]) => pos.board.get(from)?.role === "pawn")
            .flatMap(([from, tos]) => [...tos].map((to) => ({ from, to })))
            .filter(
                (m) =>
                    !pos.board.has(m.to) &&
                    (m.to >> 3) % 7 !== 0 && // no promotions
                    (m.from & 7) === (m.to & 7), // no en passant
            );
        if (moves.length < 2) continue;
        const best = await engine.score(fen, DEPTH);
        // balanced positions only: in a sharp one every pawn move loses for tactical reasons
        if (best === undefined || Math.abs(best) > 200) continue;
        seen++;
        const here: Record<string, Split> = {};
        for (const move of moves) {
            const s = await engine.score(fen, DEPTH, [makeUci(move)]);
            if (s === undefined) continue;
            const given = Math.max(0, winChance(best) - winChance(s));
            const after = pos.clone();
            after.play(move);
            for (const [name, holds] of versions({ pos, move, after })) {
                for (const bucket of [all, here]) {
                    const b = (bucket[name] ??= { picked: [], other: [] });
                    (holds ? b.picked : b.other).push(given);
                }
            }
        }
        for (const [name, h] of Object.entries(here)) {
            if (!h.picked.length || !h.other.length) continue;
            const p = (paired[name] ??= { n: 0, better: 0 });
            p.n++;
            if (mean(h.picked) < mean(h.other)) p.better++;
        }
    }
    engine.quit();
    console.log(`balanced positions ${seen}`);
    for (const [name, a] of Object.entries(all)) {
        const p = paired[name];
        console.log(
            `  ${name}: ${a.picked.length} moves, mean loss ${mean(a.picked).toFixed(1)}% vs ${mean(a.other).toFixed(1)}%; ` +
                `better in ${p ? ((100 * p.better) / p.n).toFixed(0) : "?"}% of ${p?.n ?? 0} positions with both`,
        );
    }
}

/** Squares the enemy pawns attack in `pos`, for the side to move's opponent */
const enemyPawnAttacks = (pos: Chess, side: "white" | "black") => {
    let attacked = SquareSet.empty();
    for (const p of pos.board.pawn.intersect(pos.board[opposite(side)]))
        attacked = attacked.union(pawnAttacks(opposite(side), p));
    return attacked;
};

/**
 * Space: do the quiet pawn moves that gain space give away less than the position's other pawn
 * moves? Stockfish's former count (space() up by N) against a central pawn on the fifth rank.
 */
it.skipIf(!GAMES_PGN || !STOCKFISH || !SPACE)("space vs the engine", () =>
    comparePawnMoves(SPACE, ({ pos, move, after }) => {
        const gained = space(after, pos.turn) - space(pos, pos.turn);
        const rel = pos.turn === "white" ? move.to >> 3 : 7 - (move.to >> 3);
        const fifth =
            rel === 4 &&
            (move.to & 7) >= 2 &&
            (move.to & 7) <= 5 &&
            !enemyPawnAttacks(after, pos.turn).has(move.to);
        return [
            ["gains >= 1", gained >= 1],
            ["gains >= 2", gained >= 2],
            ["gains >= 3", gained >= 3],
            ["central pawn to the 5th rank, safe from pawns", fifth],
        ];
    }),
);

/**
 * Pawn breaks: a quiet pawn move whose pawn attacks an enemy pawn (a lever, offering to open
 * lines). Any break, against a central pawn, defended (not just given away), and both.
 */
it.skipIf(!GAMES_PGN || !STOCKFISH || !BREAKS)(
    "pawn breaks vs the engine",
    () =>
        comparePawnMoves(BREAKS, ({ pos, move, after }) => {
            const me = pos.turn;
            const targets = [
                ...pawnAttacks(me, move.to).intersect(
                    after.board.pawn.intersect(after.board[opposite(me)]),
                ),
            ];
            const lever = targets.length > 0;
            const central = targets.some((t) => (t & 7) >= 2 && (t & 7) <= 5);
            // defended by its own side: taking it costs something
            const defended = after
                .kingAttackers(move.to, me, after.board.occupied)
                .nonEmpty();
            return [
                ["break", lever],
                ["break on a central pawn", central],
                ["break, defended", lever && defended],
                ["break on a central pawn, defended", central && defended],
            ];
        }),
);

it.skipIf(!GAMES_PGN || !STOCKFISH || !HOLES)(
    "holes vs the engine",
    async () => {
        const engine = new Uci(STOCKFISH!);
        await engine.init();
        const DEPTH = 10;
        const loss = { hole: [] as number[], other: [] as number[] };
        const variants: Record<string, { hole: number[]; other: number[] }> =
            {};
        const mean = (xs: number[]) =>
            xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
        type Split = { hole: number[]; other: number[] };
        const pairedVariants: Record<string, { n: number; worse: number }> = {};
        let paired = 0;
        let holeWorse = 0;
        let seen = 0;
        for (const start of gamePositions(GAMES_PGN!)) {
            if (seen >= HOLES) break;
            const pos = Chess.fromSetup(parseFen(start).unwrap()).unwrap();
            const fen = makeFen(pos.toSetup());
            const pawnMoves = [...pos.allDests()]
                .filter(([from]) => pos.board.get(from)?.role === "pawn")
                .flatMap(([from, tos]) => [...tos].map((to) => ({ from, to })))
                .filter(
                    (m) =>
                        !pos.board.has(m.to) &&
                        (m.to >> 3) % 7 !== 0 && // no promotions
                        (m.from & 7) === (m.to & 7), // no en passant
                );
            if (pawnMoves.length < 2) continue;
            const best = await engine.score(fen, DEPTH);
            // balanced positions only: in a sharp one every pawn move loses for tactical reasons
            if (best === undefined || Math.abs(best) > 200) continue;
            seen++;
            const here = { hole: [] as number[], other: [] as number[] };
            const hereVariants: Record<string, Split> = {};
            for (const m of pawnMoves) {
                const uci = makeUci(m);
                const s = await engine.score(fen, DEPTH, [uci]);
                if (s === undefined) continue;
                const given = Math.max(0, winChance(best) - winChance(s));
                const reason = positionalReasons(fen, uci).find(
                    (r) => r.kind === "weakSquare",
                );
                (reason ? here.hole : here.other).push(given);
                // narrower versions of the rule, by the squares it names
                const named = reason?.text.match(/\b[a-h][1-8]\b/g) ?? [];
                const after = pos.clone();
                after.play(m);
                const jumps = (sq: number) =>
                    attacks(
                        { role: "knight", color: "white" },
                        sq,
                        after.board.occupied,
                    );
                const knightNear = (name: string) => {
                    const target = parseSquare(name)!;
                    const enemy = after.board[opposite(pos.turn)];
                    for (const k of after.board.knight.intersect(enemy)) {
                        const one = jumps(k);
                        if (one.has(target)) return true;
                        for (const mid of one)
                            if (jumps(mid).has(target)) return true;
                    }
                    return false;
                };
                const fourth = (name: string) =>
                    name[1] === (pos.turn === "white" ? "4" : "5");
                for (const [variant, holds] of [
                    ["4th rank", named.some(fourth)],
                    [
                        "4th rank, d/e files",
                        named.some((s) => fourth(s) && "de".includes(s[0])),
                    ],
                    ["an enemy knight within 2 moves", named.some(knightNear)],
                    [
                        "4th rank & knight within 2",
                        named.some((s) => fourth(s) && knightNear(s)),
                    ],
                ] as [string, boolean][]) {
                    const v = (variants[variant] ??= { hole: [], other: [] });
                    (holds ? v.hole : v.other).push(given);
                    const h = (hereVariants[variant] ??= {
                        hole: [],
                        other: [],
                    });
                    (holds ? h.hole : h.other).push(given);
                }
            }
            loss.hole.push(...here.hole);
            loss.other.push(...here.other);
            if (here.hole.length && here.other.length) {
                paired++;
                if (mean(here.hole) > mean(here.other)) holeWorse++;
            }
            for (const [variant, h] of Object.entries(hereVariants)) {
                if (!h.hole.length || !h.other.length) continue;
                const s = (pairedVariants[variant] ??= { n: 0, worse: 0 });
                s.n++;
                if (mean(h.hole) > mean(h.other)) s.worse++;
            }
        }
        engine.quit();
        console.log(
            `balanced positions ${seen}; pawn moves leaving a hole ${loss.hole.length}, others ${loss.other.length}; ` +
                `positions with both: ${paired}, hole moves worse in ${((100 * holeWorse) / Math.max(1, paired)).toFixed(0)}%`,
        );
        console.log(
            `  all holes: ${loss.hole.length} moves, mean loss ${mean(loss.hole).toFixed(1)}% vs ${mean(loss.other).toFixed(1)}% for the rest`,
        );
        for (const [variant, v] of Object.entries(variants)) {
            const s = pairedVariants[variant];
            console.log(
                `  ${variant}: ${v.hole.length} moves, mean loss ${mean(v.hole).toFixed(1)}% vs ${mean(v.other).toFixed(1)}% for the rest; ` +
                    `worse in ${s ? ((100 * s.worse) / s.n).toFixed(0) : "?"}% of ${s?.n ?? 0} positions with both`,
            );
        }
    },
);

/**
 * P2.4f check of the bad-bishop rule against Stockfish's piece values (BAD_BISHOP positions
 * from the puzzle set): where a side has one bishop the rule calls bad and one it does not, is
 * the bad one worth less? The comparison within one position controls for the rest of it.
 */
it.skipIf(!CSV || !STOCKFISH || !BAD_BISHOP)(
    "bad bishop vs piece values",
    async () => {
        const engine = new Uci(STOCKFISH!);
        await engine.init();
        let pairs = 0;
        let badLower = 0;
        let ruleFired = 0;
        let seen = 0;
        const gaps: number[] = [];
        for (const p of readPuzzles(CSV!)) {
            if (seen >= BAD_BISHOP) break;
            const pos = Chess.fromSetup(parseFen(p.fen).unwrap()).unwrap();
            seen++;
            const bad = badBishops(pos);
            if (!bad.size) continue;
            ruleFired++;
            const values = parsePieceValues(
                await engine.evalLines(makeFen(pos.toSetup())),
            );
            if (!values) continue;
            for (const color of ["white", "black"] as const) {
                const bishops = [
                    ...pos.board.bishop.intersect(pos.board[color]),
                ];
                if (bishops.length !== 2) continue;
                const [a, b] = bishops;
                const aBad = bad.has(`${color} ${colourOf(a)}`);
                const bBad = bad.has(`${color} ${colourOf(b)}`);
                if (aBad === bBad) continue;
                const value = (sq: number) =>
                    Math.abs(values.get(makeSquare(sq)) ?? NaN);
                const [badSq, goodSq] = aBad ? [a, b] : [b, a];
                const gap = value(goodSq) - value(badSq);
                if (Number.isNaN(gap)) continue;
                pairs++;
                gaps.push(gap);
                if (gap > 0) badLower++;
            }
        }
        engine.quit();
        gaps.sort((x, y) => x - y);
        console.log(
            `positions ${seen}, with a bad bishop ${ruleFired}, pairs (one bad, one good) ${pairs}: ` +
                `bad worth less in ${badLower} (${((100 * badLower) / Math.max(1, pairs)).toFixed(0)}%), ` +
                `median gap ${gaps[Math.floor(gaps.length / 2)]?.toFixed(2)} pawns`,
        );
    },
);

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
