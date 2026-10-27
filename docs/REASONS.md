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

### R1 results (`src/reasons/motifs.ts`, 2026-10-26)

Tuned on the first 20,000 puzzles, then checked on the next 20,000 ("held out"), which were
not looked at while tuning:

| Motif | Tagged | Precision | Recall | Held out P / R | Verdict |
|---|---|---|---|---|---|
| mate | 6,525 | 0.99 | 1.00 | 1.00 / 1.00 | use |
| smotheredMate | 93 | 1.00 | 1.00 | 1.00 / 1.00 | use |
| backRankMate | 682 | 0.64 | 1.00 | 0.65 / 1.00 | use: the extras checked by hand are back-rank mates Lichess did not tag (Qe1# against pawns on g2/h2) |
| doubleCheck | 119 | 0.98 | 1.00 | 1.00 / 1.00 | use |
| fork | 2,528 | 0.85 | 0.76 | 0.86 / 0.77 | use |
| skewer | 412 | 0.79 | 0.97 | 0.81 / 0.94 | use |
| discoveredAttack | 1,002 | 0.79 | 0.96 | 0.82 / 0.95 | use |
| hangingPiece | 770 | 0.98 | 0.35 | 0.98 / 0.37 | use: rarely said, right when said |
| promotion | 492 | 0.98 | 1.00 | 0.99 / 1.00 | use |
| pin | 1,178 | 0.70 | 0.30 | 0.70 / 0.29 | use (since 2026-10-27; was 0.53 / 0.35): 13 or 14 of 15 extras checked by hand are real pins Lichess did not tag |

What made the difference, rule by rule:
- **The line must cash in.** A fork, skewer, pin or discovered attack counts only if a later
  move of the line takes one of the targets (or the target is the king). Fork precision went
  from 0.55 (facts.ts) to 0.85.
- **Mate first.** In a line that mates, forks, pins and hanging pieces on the way are not the
  point (fork 0.55 → 0.65 on its own).
- **A gain, not a trade.** A skewer whose second piece is defended (Rxe5+ Kxe5) or is a pawn is
  not a skewer; taking a pinned piece of equal value that is defended is a trade (skewer 0.58 →
  0.79).
- **Hanging piece as Lichess means it:** the first move takes an undefended piece that is not
  a pawn and not a recapture of the opponent's last capture, and the material holds two moves
  later (0.33 → 0.98).
- **Back-rank mate:** every square in front of the king holds its own piece (0.28 → 0.64).
- **Pins:** relative pins (to the queen or a rook) count, a pawn in front of a piece does not;
  three uses: taking a pinned piece for a gain, attacking a pinned piece that cannot escape,
  and taking on a square whose only defenders are pinned. A piece that just stepped in to block
  a check and is taken is won by the check, not the pin.
- **Pins, tightened (2026-10-27)**, measured rule by rule on the sample (precision of each
  against the tag: pinned defender 0.92, new pin 0.57, attacking a pinned piece 0.51, taking a
  pinned piece 0.24): a pinned pawn never counts (taking it is taking a pawn); taking a pinned
  piece counts only if the pin held through the opponent's move (they could not get out of
  it); a new pin must be made by the move (the moved piece pins, or it moved off the line);
  the pinning piece must survive the reply (Qxg7+ Kxg7: the pin never mattered); and a pin
  with or after a fork, skewer, discovered attack or double check is part of that tactic, not
  the point (Qxd4+ forks and pins: Lichess calls it a fork). Precision 0.53 → 0.70 on both
  sample and holdout, recall 0.35 → 0.29; by hand, 13 or 14 of 15 remaining extras are real
  pins (Bc4 pinning Nd5 to the king, Rc8 pinning the queen to the king), so pins are named in
  explanations now: "a pin of the knight on d5 to the king".

The tags are not ground truth: some extras are motifs Lichess did not tag (skewer Rxa6+ … Rxf6
looked like one but is a trade, and the detector was right to refuse it; Bb4 Ra7 Bxc5 is a pin
Lichess left untagged). `PUZZLE=<id>[,<id>] pnpm eval:reasons` prints a puzzle's position,
line in SAN, tags and every reason found, to check such cases.

### R2 results (`src/reasons/threats.ts`, `src/engine/threatsearch.ts`, 2026-10-26)

- `lineIdea(fen, pv)`: what a line does for the side playing it: its first move, the most
  important *trusted* motif (pins included since 2026-10-27) with the pieces it is about,
  the material won once captures settle, mate.
- `stoppedThreat(fenBefore, uci, threatPv, replyPv?)`: the opponent's threat in the null-move
  position before the move, replayed after it. It counts as stopped when it no longer wins as
  much (or no longer mates), and the engine's actual reply does not get as much either.
- `createdThreat(fenBefore, uci, ourPv)`: our line in the null-move position after the move.
- `describeIdea`: "Nxf7, a fork of the queen on d8 and the rook on h8", "Qxf7#", "Rxd8+, then
  mate on the back rank", "Nxe3+, a discovered check by the queen on g5", "Bxc2, winning the
  rook on c2, which nothing defends".
- `moveThreats(engine, fenBefore, uci)`: the two searches (depth 12 or 0.5 s each) through
  `searchOnce`; the engine must be idle. Tested with a scripted engine.

No tag set measures threats, so the check is by hand: `STOCKFISH=… THREATS=40 pnpm eval:reasons
-t threats` prints, for real puzzles and real Stockfish lines, what the blunder failed to stop
and what the solver's first move threatens. On 40 held-out puzzles the sentences read right,
e.g. quiet moves explained by what they set up: "Reh8 threatens Rh1#", "Qg6 threatens Qxg7#",
"Kh2 threatens Qxh7#". Fixed on the way: a hanging piece was named after the capture (the
capturing piece), discovered checks were called attacks on the king, motifs later in a line
read "leading to promoting".

### R4 results (in the app, 2026-10-26)

- `models/explain.ts` uses R1–R2: the opponent's answer and the better move are named when
  their line has a trusted motif ("White answers Nxf7, a fork of the queen on d8 and the rook
  on h8"), and a good move says what it stops and threatens ("g6 is the engine's choice. It
  stops Qxf7#. It threatens gxh5, winning the queen on h5, which nothing defends."). A threat
  that already says "winning the queen on h5" replaces "it attacks the undefended queen".
- A line's idea is looked for in its first 8 plies, starting within the first 5: a long
  engine line otherwise "explained" …d5 by a discovered attack of rooks after both sides
  castled.
- `engine/explainer.ts`: a second instance of the analysis engine (1 thread, 16 MB hash),
  started on the first request, one search at a time, cached by position and move. The
  Engine section asks it for the move's threats; the game review's open key moment asks it for
  the best line and the answer (depth 16 or 1.5 s), which the review does not keep.
- Text that points at the board (the owner's request): moves and squares in explanations are
  marked and light up on the board when hovered, as squares in PGN comments do.
  `models/boardtext.ts` splits the text and resolves each move in the positions it talks
  about, following a line move by move; `components/game/BoardText.tsx` renders it; the
  board draws "from-to" entries of `highlightedMovesSignal` as arrows.
- Hanging piece: the detector now gets the square the previous move *captured* on (if it
  did), not the previous move: "Qg4?? Bxg4" is a free queen, not a recapture. Recall 0.37 →
  0.47 on the held-out puzzles, precision unchanged (0.98).

### R3 results (`src/reasons/positional.ts`, 2026-10-26)

Rules over the board before and after a move, from the mover's side, each good or bad for it:
development (a minor piece off its home square in the first 15 moves), castling, the centre
(a quiet pawn move to d4/e4/d5/e5 early), a rook (or a queen after the opening) to an open or
half-open file, passed pawns created or pushed (also by a capture that removes the pawn that
stopped one), an outpost (a knight or bishop on the 4th–6th rank, defended by a pawn, that no
enemy pawn can ever attack), activity (a bishop, rook or later queen that controls 4+ more
squares), the king's pawn shield (a pawn in front of the castled king moves while the
opponent has a queen), isolated pawns (ours made by the move: bad; theirs, by taking a
neighbour: good). In explanations: a good move gets up to two of the good ones ("It castles:
the king is safer and a rook comes into play"); a bad move that loses nothing at once gets
its costs.

Checked by hand against annotated games (`PGN_FILE=… pnpm eval:reasons -t positional` prints
every move with its reasons and the annotator's comment): on a Capablanca game "a5 isolates
its own pawn on a5" sits next to "Black must lose time assuring the safety of this Pawn", "Nc6
develops the knight" next to "This move develops his Knight". Taken out after that check:
doubled pawns (a move doubles only its own pawns, by a capture that is usually a fair trade),
"the centre" and "activates" for captures (trades, not claims), an early queen "activated"
(the book's point is that it gets chased), the pawn shield in queenless endgames, and a
rook's "activates" when its open file is already said. Not done yet: mobility of the whole
army, space, weak squares.

**SF17 piece values (2026-10-27).** With Stockfish as the analysis engine, the explainer sends
`eval` for the positions before and after the move (`engine/piecevalues.ts` parses the "NNUE
derived piece values" table; other engines are not asked, and anything unexpected gives no
values). The moved piece (not a pawn or the king, not a capture: a piece about to be taken
back is worth little where it stands) gets "improves the knight: Stockfish's piece values put
it 2.1 higher on d5 than on e3", or "puts the knight on a worse square", and that replaces
"activates". Findings that shaped it:
- The values move with whose turn it is and with the whole position: after 1.e4 e5 2.Na3
  every White piece rises about 7%, the queen 8.6 → 10.4, the knight 3.9 → 4.2 with them. So
  the moved piece is measured against its side's other pieces (scaled by how much they
  changed), and Na3 is rightly no change.
- Captures were the nonsense (Bxd5 "worse" before the recapture, Qxh6 "8.5 higher" in a queen
  trade): left out.
- "Its worst piece" by value over a nominal 3/3/5/9 always picked the queen (NNUE gives it
  about 9, the minor pieces about 4): the scale is Stockfish's own (knight 4, bishop 4.3, rook
  5.3) and the queen is never called the worst piece.
- A fixed threshold made every rook move in a rook ending an improvement: a change counts at
  15% of the piece's usual value (knight 0.6, rook 0.8). On the Capablanca game it speaks on
  11 of 92 moves (15.Nd5 2.1 higher, 28.Rfd1 on the open file and 1.8 higher), on a long rook
  ending on 28 of about 160.
`STOCKFISH=… PGN_FILE=… pnpm eval:reasons -t positional` prints them next to the annotator's
comments.

### P2.4f strategic ideas, one at a time

**The bad bishop (2026-10-27, `badBishops` in `positional.ts`).** No annotated games in the
Library mention it, so the rule was measured against Stockfish's piece values instead: in the
puzzle positions where a side has one bishop the rule calls bad and one it does not, is the bad
one worth less? Comparing the two bishops of one side in one position leaves the rest of the
position out. `STOCKFISH=… BAD_BISHOP=20000 PUZZLES_CSV=… pnpm eval:reasons -t "bad bishop"`.

| Rule | Sample (pairs) | Holdout (pairs) |
|---|---|---|
| ≥2 own pawns on its colour, b–g files, fixed by enemy pawns | 52% (429) | 58% (403) |
| … and the bishop behind them | 59% | 67% |
| … behind, at most 4 squares to go to | 65% | 69% |
| … behind, at most 3 squares to go to (the rule kept) | 67% (164), median gap 0.39 | 72% (166), median gap 0.33 |

Fixed pawns alone are near a coin flip: a bishop outside its pawns is "bad but active" (a French
bishop on b5), and the Advance French's c1 bishop has the open diagonal to h6 although d4 and e5
are dark. With "behind" and "few squares" it holds about 70% of the time, so it is said as an
interpretation, and when Stockfish's piece values are known, a bishop it values at least as
high as its partner (the measured criterion; without a partner, a full bishop, 4.3) is not
called bad. A fixed 4.3 alone was too strict: after the Advance French's 3.e5, Stockfish gives
c8 4.44 and f8 4.46, so the textbook bad bishop is worth a little less than its partner but
more than 4.3 this early. Reasons: a move that leaves the opponent a bad bishop,
makes its own bishop bad, frees it (pawns give way, or the bishop comes out from behind them),
or trades it off for a knight or bishop.

**Holes (2026-10-27, `holes` in `positional.ts`).** A hole is a square on a side's third or
fourth rank, c to f files, that none of its pawns can ever cover again (no pawn on a neighbouring
file still behind it), not held by its own pawn. Its existence is a board fact; whether it
matters is the question. Measured against the engine in ordinary positions from real games:
the Lichess database, January 2013 ([database.lichess.org](https://database.lichess.org/),
CC0), moves 10 and 18 of each game, balanced positions only (within ±2 pawns), every quiet pawn
move searched at depth 10 with `searchmoves`, comparing the moves the rule says leave a hole with
the other pawn moves of the same position. `STOCKFISH=… HOLES=2000 GAMES_PGN=… pnpm eval:reasons
-t holes`. (Puzzle positions were tried first and are no good for this: they are the moment
before a blunder, where most pawn moves lose to a tactic, about 30% on average.)

| Rule | Flags | Worse within the position | Mean loss vs other pawn moves |
|---|---|---|---|
| Any hole (kept) | ~45% of pawn moves | 69-72% (two batches of 2000) | 20.0% vs 17.3% |
| 4th rank only | ~20% | 68% | +3 |
| 4th rank, d and e files (the textbook d5 hole) | ~7% | 51%: no signal | +0-1 |
| An enemy knight within two moves | ~31% | 70% | +2 |

Pawn moves that leave holes are worse on average, consistently but modestly; the textbook case
shows nothing in these games, perhaps because such a hole usually comes with compensation (the
Najdorf's ...e5). So a hole is said only as a cost: when the engine judged the move bad and no
tactic explains it, "It leaves a hole on d5: no pawn can cover it any more". Pawn captures are
left out (a trade made on purpose), as in the measurement.

**Space (2026-10-28).** Measured as holes, the other way round: do the quiet pawn moves that
gain space give away less than the other pawn moves of the same balanced position?
`STOCKFISH=… SPACE=2000 GAMES_PGN=… pnpm eval:reasons -t space`. Two notions were tried: the
count Stockfish's former hand-written evaluation used (`space()`: safe squares on the c to f
files, second to fourth ranks, double behind the side's pawns), and the human one, a central
pawn on the fifth rank that no enemy pawn attacks.

| Rule | Batch 1 | Batch 2 | Moves |
|---|---|---|---|
| space() rises by 1 or more | 53% | 51% | ~47% of pawn moves |
| … by 2 or more | 49% | 48% | ~30% |
| … by 3 or more | 64% | 58% | ~4% |
| Central pawn to the 5th rank, not attacked by a pawn (kept) | 61% | 60% | ~4% |

(Percentages: how often those moves give away less than the position's other pawn moves.)
Gaining a square or two means nothing; a real advance shows a modest, steady edge, about one to
two points of winning chances, weaker than the bad bishop's. The fifth-rank pawn is kept, as
the steadier of the two and the one a player recognises: "gains space: the pawn on e5 cramps
the opponent's position, and no pawn of theirs attacks it", an interpretation among the good
reasons of a move judged good.

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
