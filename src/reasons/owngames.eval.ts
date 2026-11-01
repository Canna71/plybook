// What Plybook says about a player's own mistakes (F.37e): every move of theirs that the review
// would call an inaccuracy or worse, explained by explainMoveFull from Stockfish's lines as the
// review gets them, printed with those lines, to read against what really happens
// (docs/EXPLANATIONS.md, "Why the explanations don't explain enough"). The threat searches are
// left out: they need the app's engine queue.
//
// STOCKFISH=… OWN_GAMES=a.pgn,b.pgn [OWN_NAMES=Player,canna71] [DEPTH=18] pnpm eval:reasons -t "own games"

import { readFileSync } from "fs";
import { it } from "vitest";
import { Color, makeUci, parseUci, Position } from "chessops";
import { makeFen } from "chessops/fen";
import { parsePgn, startingPosition } from "chessops/pgn";
import { makeSan, parseSan } from "chessops/san";
import { Uci } from "./uci.eval-helper";
import { explainMoveFull } from "../models/explain";
import { classify, scoreWin } from "../models/review";
import { Score } from "../engine/engineinterfaces";

const STOCKFISH = process.env.STOCKFISH;
const FILES = process.env.OWN_GAMES?.split(",").filter(Boolean) ?? [];
const NAMES = (process.env.OWN_NAMES ?? "Player")
    .split(",")
    .map((n) => n.trim().toLowerCase());
const DEPTH = Number(process.env.DEPTH ?? 18);
const BAD = ["inaccuracy", "mistake", "blunder"];

/** A line in SAN from `fen`, cut at its first illegal move. */
function sanLine(pos: Position, pv: string[], max = 10): string {
    const p = pos.clone();
    const out: string[] = [];
    for (const u of pv.slice(0, max)) {
        const m = parseUci(u);
        if (!m || !p.isLegal(m)) break;
        out.push(makeSan(p, m));
        p.play(m);
    }
    return out.join(" ");
}

const evaluation = (s: Score, depth: number) =>
    s.type === "cp"
        ? { pawns: s.value / 100, depth }
        : { mate: s.value, depth };

it.skipIf(!STOCKFISH || !FILES.length)(
    "own games: the mistakes explained",
    async () => {
        const uci = new Uci(STOCKFISH!);
        await uci.init();
        for (const file of FILES) {
            for (const game of parsePgn(readFileSync(file, "utf8"))) {
                const white = game.headers.get("White")?.toLowerCase() ?? "";
                const black = game.headers.get("Black")?.toLowerCase() ?? "";
                const me: Color | undefined = NAMES.includes(white)
                    ? "white"
                    : NAMES.includes(black)
                      ? "black"
                      : undefined;
                if (!me) continue;
                console.log(
                    `\n######## ${game.headers.get("White")} – ${game.headers.get("Black")}, ${game.headers.get("Date")} (${me})`,
                );
                const pos = startingPosition(game.headers).unwrap();
                const history: string[] = [];
                let ply = 0;
                for (const node of game.moves.mainline()) {
                    const move = parseSan(pos, node.san);
                    if (!move) break;
                    const fenBefore = makeFen(pos.toSetup());
                    const mover = pos.turn;
                    ply++;
                    if (mover === me) {
                        const after = pos.clone();
                        after.play(move);
                        const alternatives = await uci.lines(
                            fenBefore,
                            DEPTH,
                            2,
                        );
                        const [reply] = await uci.lines(
                            makeFen(after.toSetup()),
                            DEPTH,
                            1,
                        );
                        const best = alternatives[0];
                        const moveUci = makeUci(move);
                        if (best && reply) {
                            const loss = Math.max(
                                0,
                                scoreWin(best.score, mover, mover) -
                                    scoreWin(reply.score, after.turn, mover),
                            );
                            const cls = classify(loss, best.pv[0] === moveUci);
                            if (BAD.includes(cls)) {
                                const x = explainMoveFull({
                                    fenBefore,
                                    uci: moveUci,
                                    verdict: { class: cls, loss },
                                    bestUci: best.pv[0],
                                    bestPv: best.pv,
                                    replyPv: reply.pv,
                                    evaluations: {
                                        before: evaluation(
                                            best.score,
                                            best.depth,
                                        ),
                                        after: evaluation(
                                            reply.score,
                                            reply.depth,
                                        ),
                                    },
                                    history: history.slice(),
                                    alternatives: alternatives.map((a, i) => ({
                                        multipv: i + 1,
                                        depth: a.depth,
                                        score: a.score,
                                        pv: a.pv,
                                    })),
                                });
                                const n = `${Math.ceil(ply / 2)}${mover === "white" ? "." : "..."}`;
                                console.log(
                                    `\n=== ${n} ${node.san} [${cls}, −${loss.toFixed(0)}%] ${fenBefore}`,
                                );
                                console.log(
                                    `SAYS:  ${x?.text.join(" ") ?? "(nothing)"}`,
                                );
                                const shown = (s: Score) =>
                                    s.type === "cp"
                                        ? (s.value / 100).toFixed(2)
                                        : `#${s.value}`;
                                console.log(
                                    `BEST:  ${sanLine(pos, best.pv)} (${shown(best.score)})`,
                                );
                                console.log(
                                    `REPLY: ${sanLine(after, reply.pv)} (${shown(reply.score)})`,
                                );
                                for (const e of x?.evidence ?? [])
                                    console.log(`  [${e.basis}] ${e.text}`);
                            }
                        }
                    }
                    history.push(fenBefore);
                    pos.play(move);
                }
            }
        }
        uci.quit();
    },
);
