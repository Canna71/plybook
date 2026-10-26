# Reasons in chess terms (P2.8): research report

How ReChess can say *why* a move is good or bad the way a coach does ("it stops Ng5 from
taking on f7", "it pins the knight and wins it") instead of "it gives away 10% of winning
chances". Written 2026-10-26, before building; the plan at the end is what P2.8 will build.

## What exists today

| Module | What it knows |
|---|---|
| `models/facts.ts` | Static facts of one position: check, hanging pieces, pins *to the king*, forks. Attacks only: no exchanges, no x-rays. |
| `models/threat.ts` | The opponent's threat: the engine's best move in the null-move position (P2.2). |
| `models/review.ts` | The verdict: winning-chance loss → best / good / inaccuracy / mistake / blunder. |
| `models/whatif.ts` | Where a line leads: material change, mate. |
| `models/explain.ts` | Templates over the above: verdict, facts the move created or solved, the reply, the better move and its line. |

So we say *what happened* (verdict, material, a fork after the reply) but rarely *the idea*:
what the move stops, what it prepares, why a quiet move is good.

## Prior work

- **Lichess puzzle tagger** (`lichess-puzzler`, `tagger/cook.py`): about 60 themes from hand-written
  rules over the solution line: fork, pin, skewer, discovered attack, double check, deflection,
  attraction, interference, clearance, intermezzo, x-ray, trapped piece, capturing the defender,
  quiet move, defensive move, sacrifice, exposed king, f2/f7 attacks, named mates (back rank,
  smothered, Anastasia, Arabian, Boden, hook, dovetail…), endgame types. Each rule looks at the
  positions after the solver's moves and compares piece values. It is the closest thing to what
  we need and its tags give us a test set. It is AGPL and ReChess is MIT: **we reimplement the
  ideas, we do not copy the code.**
- **Concept-guided commentary** (Kim et al., NAACL 2025, arXiv 2410.20811): an LLM writes the
  commentary, but from concepts scored by the engine and with *all existing attacks listed in
  the prompt* to stop it inventing pieces and moves. The lesson matches our rule (P2.4b): the
  model may phrase, never calculate; it gets verified facts only.
- **Move-by-move commentary** (Jhamtani et al., ACL 2018): 298K human comments from a forum.
  Most comments describe the move or judge it; few give the reason, and those depend on the
  game's context. A model trained on them writes fluent descriptions, not reasons. Learning
  "why" from human text is not the way; computing it is.
- **Concepts inside engines** (McGrath et al., PNAS 2022, on AlphaZero): human concepts (king
  safety, mobility, material, threats) can be read from the network's layers. Not usable as-is
  (we run Stockfish, not our own network), but it supports explaining through a small set of
  named concepts.
- **DecodeChess** (commercial): explains Stockfish's moves as threats, plans, piece functions
  and tactical/strategic motifs. The same split as below; no public method.
- **Stockfish 17 `eval`** (tried on the owner's engine): Stockfish no longer prints the old
  breakdown (mobility, king safety…), but it prints *NNUE-derived piece values*: how much the
  evaluation changes if each piece is removed (e.g. a knight on f3 worth +4.28, the bishop on
  c8 −4.48). Usable for "the knight on e5 is White's best piece", "the bishop is the worst
  piece and the move improves it". The format is text for humans, not part of UCI, and only
  Stockfish has it.

## The kinds of reasons, and how to compute each

1. **What the move prevents.** The opponent's threat before the move (null-move search,
   `threat.ts`) that is gone after it: "it stops Nxf7, which forked queen and rook". Needs one
   short engine search on each side of the move; the threat is then described with the motif
   detectors (2).
2. **Tactical motifs** in the engine's line: fork, pin (also to the queen or a rook), skewer,
   discovered attack, double check, hanging and trapped pieces, removing or overloading a
   defender, deflection, attraction, intermezzo, back-rank and other named mates, promotion.
   Small detectors over the positions of the line, each a pure function with tests, measured
   on the puzzle set (below).
3. **What the move threatens or prepares.** The same null-move search *after* the move: if the
   opponent passed, what would we play? "It threatens Qxh7#." Plus the engine line's next own
   move, read with (2).
4. **Positional reasons**, when there is no tactic: the moved piece's value before and after
   (SF17 piece values), development and castling in the opening, king safety (pawn shield,
   attackers near the king, open files towards it), pawn structure (passed, isolated, doubled
   pawns, outposts), mobility, exchanges when ahead in material. Computed by us from the
   board, plus the piece values when Stockfish is the analysis engine.
5. **The role of the move**, a summary of the above: defence, prophylaxis (prevents something
   not yet a threat), attack, development, simplification, improving the worst piece.

The point of a line matters more than everything true in it. A checking move that also
attacks a rook is a fork, but in a mate in two the mate is the point. So the detectors produce
*candidate reasons* and a ranking picks one or two: mate, then material won by a motif, then
the threat stopped, then the threat created, then positional reasons.

## Measuring

`pnpm eval:reasons` (`src/reasons/puzzles.eval.ts`, its own config `vitest.eval.config.ts`,
not part of `pnpm test`) runs detectors over Lichess puzzles and compares with their theme
tags. `PUZZLES_CSV` points at `lichess_db_puzzle.csv` (or its first lines:
`curl -sL https://database.lichess.org/lichess_db_puzzle.csv.zst | zstd -dc | head -n 20001`),
`EXAMPLES=5` prints puzzles where detector and tag disagree, as Lichess links.

Baseline, today's `facts.ts` on the first 20,000 puzzles (2 s):

| Theme | Tagged | Precision | Recall | Notes |
|---|---|---|---|---|
| fork | 2,528 | 0.55 | 1.00 | |
| fork, mate ranked first | 2,528 | 0.65 | 0.93 | a fork on the way to mate is not the point |
| pin | 1,178 | 0.62 | 0.37 | only pins to the king exist today |

What the numbers mean: the tags say what a puzzle is *about*, so precision measures the
ranking as much as the detector. A detector can be right and still "wrong" here. When a
disagreement is checked by hand and the detector is right, it is noted, not "fixed".

Targets before a motif appears in explanations: precision ≥ 0.8 with recall ≥ 0.6 against the
tags, after ranking.

## Plan

- **R1, motif detectors** (`src/reasons/motifs.ts`, tested): fork, pin (relative too), skewer,
  discovered attack, double check, hanging and trapped pieces, back-rank mate and the other
  named mates, promotion; a ranking that puts mate first and prefers the motif that wins the
  material. Measured with `eval:reasons` against the targets above.
- **R2, prevented and created threats**: the null-move search before and after the move,
  described with R1 ("stops Nxf7, a fork of queen and rook"; "threatens Qxh7#"). One extra
  short search per explained move; cached with the review.
- **R3, positional reasons**: development, castling, king shelter, pawn structure, mobility of
  the moved piece, from the board; SF17 piece values when Stockfish analyses (an `eval` request
  through the engine wrapper, parsed defensively and skipped for other engines).
- **R4, sentences**: `explain.ts` takes the ranked reasons; the Engine section and the review
  show them. Optionally P2.4b phrases them better, from the reasons only.
- **R5, the tutor** (P2.9) uses R1–R4 for "Are you sure? It lets Ng5 fork your queen and rook."

Risks: the `eval` output is not a stable interface (only Stockfish, may change between
versions); extra engine searches cost time in long reviews (search depth kept low, results
cached); positional reasons have no tag set to measure against, so they are checked by hand on
annotated master games.
