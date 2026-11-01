# Move explanations: options, decision, contract

How Plybook says why a move is good or bad, in words grounded in the engine and the board. The
reasons themselves (motifs, threats, positional rules, and how each is measured) are in
`docs/REASONS.md`; this page covers the options considered, the structured result, and its
limits. Written 2026-10-27.

## Options checked (2026-10-27)

What each upstream resource offers, as found on its own pages. Verified facts are marked;
everything else is a design choice of ours.

| Resource | Verified | Blockers for Plybook |
|---|---|---|
| [ChessCoach](https://github.com/chrisbutner/ChessCoach) | GPLv3-or-later. Its UCI engine adds a `comment` command (commentary on the last move, history given with `position startpos moves …`). A second network writes English from the engine's state; trained on scraped commented games. Pretrained data: 372 MiB download. | Builds with TensorFlow 2, Protobuf and a GPU or TPU; Linux scripts, a Visual Studio build on Windows; not practical on macOS or as a desktop dependency. The author: commentary "is not very insightful and often wrong". |
| [Lee et al. 2022](https://arxiv.org/abs/2212.08195) ([HTML](https://arxiv.org/html/2212.08195)) | Leela gives control tags (move quality from win probabilities, the suggested move); a BART model writes commentary conditioned on them and on attack lists from the board. 373,919 gameknot.com comments; human A/B tests on Mechanical Turk. | No code, model or data release found. The architecture is ours with templates in place of BART. |
| [Queen, Bhaskar et al. 2026](https://arxiv.org/abs/2610.03695) ([project](https://queen-project.github.io/), [code](https://github.com/queen-project/queen), [weights](https://huggingface.co/collections/princeton-nlp/queen-chess-models)) | Code Apache-2.0, README: "clean code release coming soon". Weights: two 3B models (the paper says 4B), fine-tuned from SmolLM3-3B; the [model card](https://huggingface.co/princeton-nlp/queen_pawn-8) asserts no license for the combined release. Input is a FEN (plus optional history); it explains its own critical line. | Linux, NVIDIA GPU with BF16, CUDA 13, tested on H100 only, no CPU. No documented way to explain a move the user gives. The card: "Explanations and variations may be wrong." |
| [python-chess](https://github.com/niklasf/python-chess) | GPL-3.0, package `chess`: legal moves, PGN, UCI/XBoard engines, attacks and pins. | Not needed: Plybook is TypeScript and Rust, and [chessops](https://github.com/niklasf/chessops) (same author, GPL-3.0) covers the same ground in the app already. |
| [Stockfish](https://github.com/official-stockfish/Stockfish) ([docs](https://github.com/official-stockfish/Stockfish/wiki)) | GPL-3.0; whoever distributes it must include the license and the source. Its `eval` command prints NNUE piece values (not UCI, Stockfish only). | None: the user installs the engine; Plybook talks UCI to it and bundles no engine. |

**Licensing note.** Plybook bundles chessground and chessops (and shakmaty, pgn-reader in Rust),
all GPL-3.0, so Plybook is GPL-3.0-or-later since 2026-10-27 (`LICENSE`; it said MIT before).
GPL code such as ChessCoach would therefore not be a license blocker, only a practical one.

## Decision

An engine-grounded pipeline of our own, which Plybook had for the most part (P2.3, P2.4a, P2.8):
ChessCoach and Queen cannot run on users' machines and do not explain a given move reliably;
Lee et al. is the same architecture without released parts. Queen is worth watching: a
CPU-capable build with a clear license could plug in as another wording provider behind the
same validation (P2.4b).

```
position + move + game history
  -> validation          chessops: the move is legal (explain.ts play), lines replayed (legalLine)
  -> engine analysis     Stockfish over UCI (useChessEngine, explainer.ts): evaluations, best
                         line, the answer's line, null-move threat searches, piece values
  -> evidence            facts.ts (board facts), reasons/motifs.ts (tactics a line cashes in),
                         reasons/threats.ts (threats stopped and made), reasons/positional.ts
                         (readings of the position: interpretations)
  -> explanation         explain.ts explainMoveFull: sentences built with their evidence;
                         optionally worded by a model (src-tauri/src/model.rs)
  -> validation          lines legal, a shallow search judges nothing (MIN_DEPTH); a model's
                         wording that adds moves, squares or claims is thrown away (coach.ts)
```

## The structured result (`MoveExplanation`, `src/models/explain.ts`)

| Field | What it holds |
|---|---|
| `fenBefore`, `move` | The position and the move (UCI and SAN) |
| `side` | The side that moved: every score is from its point of view |
| `best` | The engine's choice, when given |
| `evaluation.before`, `.after` | `{ type: "cp", value }` (centipawns) or `{ type: "mate", value }` (positive: the mover mates), for the mover |
| `evaluation.depth` | The shallower of the two searches |
| `evaluation.class`, `.loss` | The verdict and the winning chances given away (%), on the scale where mate and centipawn scores compare; absent when inconclusive |
| `reply` | The opponent's strongest answer |
| `lines` | The answer's and the better move's lines, replayed from their positions and cut at the first illegal move (`dropped` counts what was cut) |
| `evidence` | Each claim with its basis: `board` (a fact of the position), `line` (a played-out engine line; `line` names which), or `interpretation` (a rule's reading, `verified: false`) |
| `text` | The sentences shown |
| `limits` | What the analysis could not see or settle, in words |
| `inconclusive` | Too little analysis to judge: no verdict, no better move |
| `validation` | `ok`, and the problems found (lines cut) |

No confidence numbers: there is no calibrated method to give one.

Rules that keep it honest:
- **An evaluation drop is not an explanation.** The verdict sentence says how much was given
  away; the why comes only from board facts and played-out lines.
- **No motif from a board pattern alone.** A double attack on the board is "attacks the king and
  the rook at once"; "fork" needs a line that wins one of them (motifs.ts, measured against the
  Lichess puzzle tags in REASONS.md).
- **Shallow is said, not judged.** Below depth 10 (`MIN_DEPTH`): "the engine has not searched
  deep enough to judge it yet (depth 8)", and no better move.
- **History matters.** The engine searches with the game's moves, so it counts repetitions
  (P2.4e); a move that repeats the position a third time says so. Where the scores may come
  from a search without the game (an older review), a repeated position is noted.
- **A model only rewords**, and its wording is dropped if it names a move or square, or makes a
  claim (fork, pin, mate, wins, …), that the computed text does not. Grounding does not make a
  model correct; the check only catches additions.

## Tests

- `src/models/explainfull.test.ts`: tactical positions (a hanging queen with the answer and the
  material, a mate in one with a mate score kept as such), lines cut at an illegal move, quiet
  positions that must claim no tactic (1.e4, a quiet inaccuracy, a double attack the line does
  not cash in), and the limits (shallow, no evaluation, a third repetition).
- `src/models/coach.test.ts`: a model's wording with added moves or claims is refused.
- `src/reasons/*.test.ts` and `pnpm eval:reasons`: the detectors (REASONS.md).

## Setup

Nothing beyond the analysis engine: Stockfish in the Engines folder (Settings → Engines), as
for analysis. Piece values need Stockfish 17 or later. The optional wording model is set up in
Settings → Explanations (P2.4b, ROADMAP.md).

## Chesserly (P2.4g, studied 2026-10-28)

[Chesserly](https://github.com/sekhniashviligiorgi21/Chesserly) ([live](https://chesserly.vercel.app),
[listing](https://hunted.space/product/chesserly)): MIT license, so its code could be taken
into Plybook (GPL-3.0) with its notice kept. Read at commit `06fca4c` (2026-10-18). A Vue app;
Stockfish runs in the browser as WebAssembly (`src/engine/engine.js`), Firebase keeps users'
games; the FastAPI `main.py` of the listing is an older server-side path with the same idea.

**Move classes** (`engine.js`, `getEvaluation`). Win chance on the Lichess curve (the same
constant as `review.ts`), on 0 to 1. A move that is not the engine's first choice is classed by
win chance lost: excellent up to 2 points, good up to 5, inaccuracy up to 10, mistake up to 20,
blunder beyond (Plybook, as Lichess: inaccuracy from 5, mistake from 10, blunder from 15).
"Best" is only the engine's own move, and becomes:
- **Great** when it beats the second-best move by at least 10 points of win chance (an extra
  MultiPV 2 search at depth 10), unless it takes back on the square just taken, or takes a
  piece nothing defends. Saving a lost position (3 pawns down) by stalemate is great too.
- **Brilliant** when it is also a sacrifice, by a static exchange count on the moved piece's
  square (attackers and defenders by value, no pins or x-rays), not a book move or a
  recapture, the mover was not already winning (85% or less before), and stays at 40% or more
  without losing over 10 points.
- **Book** when the opening tree (`public/book/openings.json`) has the move.

**Game accuracy** is not Lichess's: the mean of fixed weights per class over the player's moves
(best, great, brilliant and book 100, excellent 90, good 80, inaccuracy 20, mistake 10,
blunder 0; `Analysis.vue`, `saveGameInsights`). Coarse: a move losing 6 points and one losing
9 both score 20, and good to inaccuracy drops from 80 to 20. Plybook's (Lichess's
volatility-weighted and harmonic means of per-move accuracy, `gameAccuracy`) keeps more. The
README's "estimated performance rating" is not in this commit's code.

**Words.** None about why: each move gets its class in a sentence ("Nf3 is a great move!").
The Insights page writes advice over many games from counts ("You average 2.3 mistakes+blunders
per game…", endgame accuracy against overall, a "playstyle" radar), with the phases split at
ply 12 and where material falls (both under 14, or either under 10).

**Mistakes as puzzles** (`extractedPuzzles`): the position before each mistake or blunder, the
engine's move as the answer, repetitions and due dates kept, as Plybook's P1.3 does.

**What Plybook takes, as ideas** (no code: each fits Plybook's own modules better rewritten):
- **The only good move** (their "Great"): a gap of 10 points or more to the second-best line
  is an engine fact, not a reading, and the analysis already searches three lines. Said as
  evidence ("the only move that keeps the balance: the next best, Bd3, gives away 14%"), not as
  a badge (ROADMAP P2.4h).
- **Sacrifices** (their "Brilliant"): worth naming when the engine's best move gives material
  that the line wins back or pays for. Their static exchange count misses pins and x-rays;
  Plybook would read it from the engine line (`lineOutcome`), and measure it like the P2.4f
  ideas before saying it (P2.4i).
- **Book moves in the review**, from the user's Polyglot books, so opening moves are not graded
  against the engine (P1.5).
- **Accuracy by phase across reviewed games** (opening, middlegame, endgame), with Plybook's
  accuracy formula rather than class weights (P1.6).

Not taken: their accuracy formula (coarser than the one Plybook has), and the classes
"excellent" and "good" as separate labels (Lichess's thresholds, which Plybook matches on 99.8%
of moves, P1.2).

## Why the explanations don't explain enough (F.37, 2026-11-01)

The owner: the coach's text reads like the plain one and does not help understand why a move
was bad. Measured on the owner's own games: the two with real play (the History win against
Stockfish, 1-0, and the Lichess game of 2024-10-02 as Black), every move of the owner's that
the review calls an inaccuracy or worse, explained by `explainMoveFull` with Stockfish at depth
18 as the review gives it its lines (the threat searches left out). The scratch script is
described under (e) below; eight moves:

| Move | What Plybook says | What happens |
|---|---|---|
| 12…Ng4 (−36%) | "White answers Nxc5, winning the bishop on c5, which nothing defends … Better was Nxe4: it saves the bishop" | Right, and enough. |
| 10…d5 (−10%) | "White answers exd5 and attacks the knight on c6 with a cheaper piece. Better was a5." | …exd5 takes back at once: the attack is no point. The cost (the centre opens, White's pieces get e-file and b4 play) is not said, nor why a5. |
| 12.e5 (−13%) | "Black answers Qxe3 and pins the pawn on f2 to its king and attacks the undefended rook on e1 … Black wins material (+1). Better was Qh3." | Qxe3 is a queen trade (Bxe3), then …dxe5 wins the pawn: the facts named are of a position that lasts one move. Qh3: no reason. |
| 13.exd6 (−9%) | Same Qxe3 sentence; "Better was Qh3. After Qh3 d5 Qxe6+ …: White wins material (+1)" | The point is to keep the queens on and attack e6. |
| 9.Re1 (−9%) | "Black answers Qb6 and attacks the undefended queen on d4. Better was e5: it attacks the knight on f6 with a cheaper piece." | Black's king is still in the centre and Black behind in development; e5 opens the centre now; after Re1 Qb6 the queens come off and that chance is gone. |
| 4.Nc3 (−10%) | "Black answers exd4 and attacks the knight on c3 … After d5 Nb8 Nxe5 Nxe4 Qe2 Qe7 Qxe4: White wins material (+3)" | +3 is counted where the engine line stops, mid-exchange; the real gain is a pawn and space. |
| 17.g3 (−16%) | "It leaves a hole on f3 … Black answers exf4 and attacks the bishop on e3 … Better was Rf1." | The trades that follow (…Rxe1+) and their result are not said. |
| 22.gxh5+ (−5%) | "It isolates its own pawn on h4 … Black wins material (+1)" | About right. |

What goes wrong, in order of how often:

1. **The first reply's board facts stand for the reason.** "Attacks the knight with a cheaper
   piece", "pins the pawn to its king": true for one move, gone after the recapture. A human
   names what the exchange leads to.
2. **The material is counted where the engine line stops**, mid-exchange at times (+3 for a
   pawn).
3. **The better move gets no reason** when it wins nothing at once (Qh3, Rf1, a5).
4. **Costs that are not material are not looked for**: the queens coming off when ahead in
   development, the centre opening with a king in it, a weakness that the line later wins.
   Plybook compares evaluations and the first moves, never the two futures.
5. **The coach model sees only the sentences**, not the lines or the facts behind them, and may
   only reword them (P2.4b's rule). It cannot add what isn't there, as the owner noticed.

### Plan

Each step is measured on the owner's games (and the puzzle set, for regressions) before it is
shown; each keeps the contract above (no claim without its evidence).

- **(a) Settle the line before reading it.** Play the reply line on until the exchange is over
  (no capture or check pending, the captured material recaptured), and read the facts and the
  material there: "After the queens come off (Qxe3 Bxe3), dxe5 wins the pawn". A board fact of
  the first reply that the next move undoes (a recapture, the attacked piece taking back) is
  dropped. Fixes 1 and 2; uses `lineOutcome` and `legalLine`.
- **(b) A reason for the better move, always.** Search the better move as the played one is
  searched (threats it makes, `explainThreats`; its settled line, from (a)); failing a
  tactic, the largest difference in (c). "Better was Qh3: it keeps the queens on and attacks
  e6."
- **(c) Compare the two futures.** At the settled points of the reply line and the better
  line, compare: material, the kings (castled or not, open files and pawns in front, pieces
  near), development, pawn weaknesses (`positional.ts`), and Stockfish's piece values. Say the
  largest difference as the cost, marked as interpretation: "After Re1 the queens come off
  while Black's king is still in the centre: White's lead in development counts for less."
  New readings: queens traded when ahead in development; the centre opening with a king in
  it.
- **(d) Let the coach see the evidence.** Send the model the evidence (the settled lines in
  SAN, the facts, the comparison of (c)), not only the sentences, and let it say what the
  evidence shows in a coach's words; keep the check that every move and square it names is in
  the evidence, and label its text as the coach's reading. The model then explains rather than
  rewords; P2.4b's rule changes from "only reword" to "only from the evidence".
- **(e) Measure on the owner's games.** The scratch script (the owner's games, Stockfish, each
  mistake's explanation and lines) becomes `src/reasons/owngames.eval.ts` (`pnpm
  eval:reasons`, with the games' paths): the table above, rerun after each step, read by the
  owner. A 👍/👎 under an explanation in the app, kept locally, would add verdicts on more
  positions.

Order: (e) first (cheap, and it is the yardstick), then (a), (b), (c), (d).

**Done so far.** (e) is `src/reasons/owngames.eval.ts` (`STOCKFISH=… OWN_GAMES=a.pgn,b.pgn
OWN_NAMES=Player,canna71 pnpm eval:reasons -t "own games"`). After (a): 10…d5 says "White
answers exd5." and no more; 12.e5 "Black answers Qxe3. After Qxe3 Bxe3 dxe5: Black wins
material (+1)."; 4.Nc3 no longer claims +3; 12…Ng4 "After Nxc5: White wins material (+3)".
What is left is mostly silence where a reason is wanted (10…d5, 9.Re1, the better moves
Qh3, Rf1, a5): (b) and (c). After (b), in part: "Better was Qh3: it stops Qxe3" (12.e5,
13.exd6), "d5: it stops exd4" (4.Nc3), "Nxe4: it saves the bishop on c5 and stops Nxc5",
"e5: it takes a share of the centre" (9.Re1); "stops" only for an answer that was there
before the played move, so not "a5 stops exd5" after 10…d5. Still bare: a5, Bd6, Rf1.

## Not done (yet)

Both ideas from the Chesserly study that explain moves are done: the only good move (P2.4h,
`reasons/onlymove.ts`, from the engine's two best lines) and sacrifices (P2.4i,
`reasons/sacrifice.ts`, from the line played out, measured in `docs/REASONS.md`). The other
two, book moves in the review and accuracy by phase, are P1.5 and P1.6.

The Engine section, the review's key moments and the tutor's questions all use
`explainMoveFull` (P2.4d); the first two show the Evidence panel. Since P2.4e the engine
searches with the game's moves (`models/gamehistory.ts`), so it counts repetitions; only
review scores, which may predate that, keep the note that the engine judged without the game.
