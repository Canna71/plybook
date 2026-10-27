# Move explanations: options, decision, contract

How ReChess says why a move is good or bad, in words grounded in the engine and the board. The
reasons themselves (motifs, threats, positional rules, and how each is measured) are in
`docs/REASONS.md`; this page covers the options considered, the structured result, and its
limits. Written 2026-10-27.

## Options checked (2026-10-27)

What each upstream resource offers, as found on its own pages. Verified facts are marked;
everything else is a design choice of ours.

| Resource | Verified | Blockers for ReChess |
|---|---|---|
| [ChessCoach](https://github.com/chrisbutner/ChessCoach) | GPLv3-or-later. Its UCI engine adds a `comment` command (commentary on the last move, history given with `position startpos moves …`). A second network writes English from the engine's state; trained on scraped commented games. Pretrained data: 372 MiB download. | Builds with TensorFlow 2, Protobuf and a GPU or TPU; Linux scripts, a Visual Studio build on Windows; not practical on macOS or as a desktop dependency. The author: commentary "is not very insightful and often wrong". |
| [Lee et al. 2022](https://arxiv.org/abs/2212.08195) ([HTML](https://arxiv.org/html/2212.08195)) | Leela gives control tags (move quality from win probabilities, the suggested move); a BART model writes commentary conditioned on them and on attack lists from the board. 373,919 gameknot.com comments; human A/B tests on Mechanical Turk. | No code, model or data release found. The architecture is ours with templates in place of BART. |
| [Queen, Bhaskar et al. 2026](https://arxiv.org/abs/2610.03695) ([project](https://queen-project.github.io/), [code](https://github.com/queen-project/queen), [weights](https://huggingface.co/collections/princeton-nlp/queen-chess-models)) | Code Apache-2.0, README: "clean code release coming soon". Weights: two 3B models (the paper says 4B), fine-tuned from SmolLM3-3B; the [model card](https://huggingface.co/princeton-nlp/queen_pawn-8) asserts no license for the combined release. Input is a FEN (plus optional history); it explains its own critical line. | Linux, NVIDIA GPU with BF16, CUDA 13, tested on H100 only, no CPU. No documented way to explain a move the user gives. The card: "Explanations and variations may be wrong." |
| [python-chess](https://github.com/niklasf/python-chess) | GPL-3.0, package `chess`: legal moves, PGN, UCI/XBoard engines, attacks and pins. | Not needed: ReChess is TypeScript and Rust, and [chessops](https://github.com/niklasf/chessops) (same author, GPL-3.0) covers the same ground in the app already. |
| [Stockfish](https://github.com/official-stockfish/Stockfish) ([docs](https://github.com/official-stockfish/Stockfish/wiki)) | GPL-3.0; whoever distributes it must include the license and the source. Its `eval` command prints NNUE piece values (not UCI, Stockfish only). | None: the user installs the engine; ReChess talks UCI to it and bundles no engine. |

**Licensing note.** ReChess bundles chessground and chessops (and shakmaty, pgn-reader in Rust),
all GPL-3.0, so ReChess is GPL-3.0-or-later since 2026-10-27 (`LICENSE`; it said MIT before).
GPL code such as ChessCoach would therefore not be a license blocker, only a practical one.

## Decision

An engine-grounded pipeline of our own, which ReChess had for the most part (P2.3, P2.4a, P2.8):
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
- **History matters.** A move that repeats the position a third time says so; a repeated
  position notes that the engine judged it without the game (the explainer engine is given a
  FEN, not the moves).
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

## Not done (yet)

- The main analysis and the explainer search from a FEN, not the game's moves: the engine itself
  does not see repetitions (the explanation says so when it matters).
- Strategic explanations beyond the positional rules: only where evidence supports them, one
  idea at a time (ROADMAP P2.4f).

The Engine section, the review's key moments and the tutor's questions all use
`explainMoveFull` (P2.4d); the first two show the Evidence panel. The engine seeing the game is
ROADMAP P2.4e.
