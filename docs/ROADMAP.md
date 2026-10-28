# ReChess roadmap

The goal is a study app that helps a club player find better moves and understand **why** a move
is best, fed by the games they already play on chess.com and Lichess.

How this file is used:

- Each item has an ID (`P1.1`), a status box and acceptance criteria ("Done when").
  `[ ]` todo, `[~]` in progress, `[x]` done (with the branch or commit), `[-]` dropped (with why).
- One feature branch per item (`feature/<topic>`), merged into `develop`.
- Refactor only the code a feature touches, while working on it. Refactors worth noting go under
  the item as "Refactor:" lines, so the cleanup is tracked too.
- Update this file in the same branch that changes an item's status.
- Decisions that need the owner's OK are marked **Decision**. Do not start them without it.

## Principles

- **The engine calculates, words explain.** Explanations are built from engine lines and facts
  computed with chessops. An LLM may phrase them, never calculate them.
- **Network goes through Rust only.** The CSP blocks webview network access. Each online source
  is a narrow Rust command with fixed hosts and validated parameters (see `net.rs`).
- **Imported data lands as plain PGN in the Library** where possible, so it stays readable,
  editable and portable.

---

## Phase 1: learn from your own games

- [x] **P1.1 Import games from chess.com and Lichess** (`feature/online-import`)
  - Accounts (site + username) managed in Settings; "Sync" downloads games month by month into
    `Library/Online/<site>/<username>/<YYYY-MM>.pgn`.
  - Sync is incremental: past months already on disk are skipped, the latest month is refreshed.
  - Done when: adding an account and syncing creates the month files, a second sync only
    re-fetches the latest month, errors (unknown user, offline) show a toast.
  - Refactor: new `src-tauri/src/net.rs` as the single place for HTTP, with a fixed User-Agent.
  - Refactor: Settings page split into sections (`components/settings/EngineSettings`,
    `OnlineAccounts`).
  - Known limits: no progress bar during a long first sync; no cancel.
- [x] **P1.2 Whole-game review** (`feature/game-review`; owner review pending)
  - Background review of a game with the active engine: eval graph, accuracy per side,
    move classification by **win-probability loss** (Lichess formula), list of key moments.
  - Done when: a 40-move game reviews in under a minute at a modest depth, labels match
    Lichess's on a few sample games within reason, results are saved in the PGN (`[%eval]`, NAGs).
  - Refactor: classification moves out of `Review.tsx` into a pure module with tests;
    fix props destructuring in `Review.tsx`; first Vitest setup.
  - Status: implemented in `src/models/review.ts` (Lichess win %, accuracy, mate rules) and the
    Evaluation tab. Labels agree with Lichess's own on 99.8% of 4,048 moves (50 analysed
    games, same evals). Review runs the mainline only, depth 18 / 1 s per position
    (`engine.review.*`).
  - Fixed on the way: `[%eval 0.18]` without depth was not parsed, so Lichess evals were
    ignored; the standard start position gets +0.2 since exports never evaluate it.
  - Known limits: re-reviewing keeps NAGs added by an earlier review; a Maia-style (1 node)
    engine cannot review, the user must select a full-strength one.
- [x] **P1.3 Mistakes become puzzles** (`feature/mistake-puzzles`; owner review pending)
  - Blunders and mistakes from reviewed games are added to the existing spaced-repetition puzzles
    ("find the better move"), linking back to the game.
  - Done when: after a review, a "Train my mistakes" set exists and uses the current scoring.
  - Status: the Evaluation tab makes one PGN per mistake/blunder in `Library/Mistakes` (position
    before the move, engine's move as the solution, Site links the original game) and registers
    it as a puzzle (blunders weigh 400, mistakes 300). The side defaults to the player's (online
    account name or "Player"). Puzzles view: "Train my mistakes"; Next Puzzle stays in the set.
  - Known limits: only the engine's exact move is accepted (another equally good move counts as
    wrong); evals imported without a best move need Analyze Game first.
- [x] **P1.4 Auto sync and review** (optional): sync accounts on startup and review new games
  in the background.
  - Status 2026-10-27 (`feature/auto-sync`): 15 s after start, accounts not synced for 6 hours
    sync (`online/autosync.ts`, setting `online.autoSync`, on by default, switch in Settings →
    Accounts); the newest 5 new games are reviewed one by one on the explainer engine (depth
    12 or 0.3 s a position, `engine/backgroundreview.ts`, tested): evaluations and ?!/?/??
    go into the month file, as a review on the board writes them, replacing only that game
    (the file is read again just before). Today lists them under "New online games" with
    your mistakes; a click opens that game (`/game?path=…&game=N`, a new URL parameter).
    Toasts say how many games came and how many mistakes the review found.
  - Not tried with a real account here (the owner's settings have none).
- [x] **P1.5 Book moves in the review** (from Chesserly, P2.4g): moves found in the user's
  Polyglot books (Settings → Books) are marked as book moves and not graded against the
  engine, and the review says where the game left the book. Done when: a reviewed game
  shows its book moves, and their accuracy is not counted.
  - Status 2026-10-28 (`feature/book-moves`): a move is a book move while every move before
    it was and any book in the Books folder has it with a weight above 0 (`bookPlies`,
    `models/books.ts`; compared by SAN). Class `book` in `review.ts`: no ?!/?/??, not a key
    moment or a puzzle, left out of the accuracy (the volatility weights still come from the
    whole game). The Evaluation tab says "In your books until 4… Nf6, out of book with 5. h4";
    the board review and the background review (P1.4) leave book moves unmarked too. Tried in
    the dev app with a GM book: a side whose moves were all book shows "–" for accuracy.
  - Known limit: no book installed, nothing changes; with several books, one is enough.
- [~] **P1.7 A starter opening book and opening names** (owner's question, 2026-10-28): today
  book moves (P1.5), the engine's book (Play) and the Explorer's book need a Polyglot book the
  user finds and imports, and most books passed around (gm2001.bin, Performance.bin…) come
  without a license. Instead, build one from free data: a script in `tools/` that turns
  strong games of the Lichess database (CC0; e.g. both players 2200+, moves played at
  least N times, up to move 15-20) into a Polyglot book with the same keys `books.rs` reads,
  published as a release asset and offered in Settings → Books as "Download the starter book"
  (not bundled: it would grow the installer). Plus opening names from
  [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings) (CC0, ECO code,
  name and position per line, a few hundred KB of TSV, small enough to bundle): the review
  and the move list say "Ruy Lopez: Morphy Defense (C78)" and the book line names the
  opening it left. Done when: a new user gets book moves and opening names without hunting
  for files, and the sources and licences are in the README.
  - Status 2026-10-28 (`feature/openings`):
    - [x] Opening names: the five TSVs bundled (`src/assets/openings`, commit recorded in its
      README), `models/openings.ts` (each line played to its position; a position is matched
      on pieces, side and castling, so transpositions are named; the most specific name on
      the way wins). All 3,865 lines parse; one position has two names (Van Geet: Nowokunski
      Gambit = King's Gambit Accepted: Mason-Keres Gambit; the first in the files wins).
      Shown in "About this position" ("E20 Nimzo-Indian Defense", also after 1.c4 Nf6 2.Nc3
      e6 3.d4 Bb4) and the review ("Opening: …", the book line names where it left the book).
    - [x] A book from games, made in the app instead of a release asset (no hosting, no
      release step, the user picks the games): Settings → Opening books → "Make a book from
      games…" reads a .pgn or .pgn.zst (`book_build`, `books.rs`): both players at a chosen
      rating or more, the first 12 moves, moves played in 5 games or more, weight 2 × wins +
      draws for the side that moved. Tested in Rust (read back with the book reader); the
      January 2013 Lichess month: 121,332 games, 9,525 rated 1800+, 3,111 moves, 48 KB.
    - [ ] A ready-made starter book (one click for a new user): needs either a hosted file (a
      GitHub release asset, made with the same code) or a download of a Lichess month from
      Settings (large: recent months are tens of GB). Waiting for the owner's choice.
    - [ ] Opening names in the move list itself (now in "About this position").
- [x] **P1.6 Accuracy by phase** (from Chesserly, P2.4g): across the reviewed games of an
  account, accuracy in the opening, middlegame and endgame (the endgame as P2.4f defines it),
  with ReChess's accuracy formula, to show where a player loses most. Done when: the Today or
  History page shows the three numbers with the number of games behind them.
  - Status 2026-10-28 (`feature/phase-accuracy`): `models/phases.ts` (the opening is moves
    1-10, the endgame `isEndgame` from P2.4f, the rest the middlegame; per game with
    `gameAccuracy(moves, keep)`, whose volatility weights still come from the whole game;
    book moves left out; a phase counts in a game from 3 of the player's moves) and
    `online/phasestats.ts` (the newest 50 reviewed games of all accounts, read from their
    month files on Today, book lookups cached by position). Today shows an "Accuracy by phase"
    card with each phase's accuracy and games, the weakest in red.
  - Not tried with real games: the owner's settings have no online account (TESTING.md).
- [ ] **P1.8 More from Lichess and chess.com** (owner's question, 2026-10-28; candidates, to
  be chosen). Today ReChess imports both sites' games (with Lichess's own evaluations and
  clocks), the Lichess explorer (personal token), tablebase and puzzle database. What else
  their public APIs and data allow:
  - [ ] **Lichess cloud evaluations** (`/api/cloud-eval`, no token): deep Stockfish lines
    for positions Lichess has already analysed, at once. Faster reviews and a second
    opinion in the Engine section; mostly openings and common positions. (The same data as
    a download, `lichess_db_eval.jsonl.zst`, 416 million positions, is too big to use.)
  - [ ] **Lichess studies** (`/api/study/by/{user}/export.pgn`; public ones with no token,
    private ones with `study:read`): bring your studies into the Library, kept in sync.
    Writing back to a study (`study:write`) could follow.
  - [ ] **Lichess puzzle history** (`/api/puzzle/activity`, `puzzle:read`): the puzzles you
    solved there count in ReChess's puzzle rating and weak themes, and are not shown again.
  - [ ] **Lichess broadcasts** (database.lichess.org, 1.26 million games of official
    over-the-board events since 2020, 744 MB in all, CC BY-SA 4.0): the best source for
    "Make a book from games" (strong games, small monthly files) and for the game database
    (P3.1). A link or a download in Settings. A book made from them stays the user's; if
    ReChess ever shipped one, it would need the attribution and share-alike terms.
  - [ ] **chess.com ratings** (Published-Data API `/pub/player/{user}/stats`, no login):
    your ratings by time control and puzzle rating on Today. chess.com has no API for
    third-party apps beyond public data: no login, no studies, no puzzles history, no
    writing. A password would add nothing, and ReChess must never ask for it.
  - [ ] **Playing on Lichess from ReChess** (Board API, `board:play`): possible, but only
    with every engine aid, explanation and tutor switched off while a game runs (Lichess's
    fair-play rules). Low priority.
  - How access works: tokens are entered in Settings and kept in the OS keychain
    (`secrets.rs`); a token is never pasted into a chat or a file. Each feature asks only for
    the scope it needs (Lichess personal tokens choose scopes when created).

- [x] **Fix: played games in History** (`feature/play-history`): saved after every move under
  the game's Timestamp, openable from History, result written at checkmate/stalemate.

## Phase 2: understand why

- [x] **P2.1 What-if mode** (`feature/what-if`; owner review pending): play a candidate move in
  analysis and see the refutation line, with the material or mate it leads to.
  - Status: a card above the engine lines judges the move just played against the engine's view
    of the position before it (review rules: lost winning chances, label, preferred move) and
    sums up where the engine line goes ("Then Nxe5 Qg5: White wins material (+1)"), counting
    material only once captures are over. Analysed positions are remembered for the session
    (deepest main line per position); review evals in the PGN are used as a fallback.
  - Known limits: the move before must have been analysed (step back once) or reviewed.
- [x] **P2.2 Show the threat** (`feature/threat`; owner review pending): what the opponent would
  do if it were their move (null-move analysis), as an arrow and a line.
  - Status: the warning-triangle button next to the analysis switch searches the position with
    the other side to move; red arrows and a sentence ("Black threatens Nxf3+ (check, takes the
    knight on f3)"). Not available in check. `src/models/threat.ts` with tests.
  - Refactor: engine lines are built from the position the engine searched (`analyzedFen`), not
    the board, so stale infos no longer produce illegal lines; props destructuring fixed.
- [x] **P2.3 Position facts** (`feature/position-facts`; owner review pending): hanging pieces,
  forks, pins, mate threats, king safety, material at the end of the PV, computed with chessops.
  Shown as short bullet points per move.
  - Status: `src/models/facts.ts` finds check, forks (king, more valuable or undefended
    targets), pins against the king and hanging pieces (undefended, or attacked by a cheaper
    piece); facts the last move created come first, marked "new"; lasting pawn facts are hidden.
    About 0.9 facts per position on 10 real games. Material at the end of the PV is in P2.1,
    mate threats in P2.2.
  - Known limits: attacks only (no exchange evaluation, no x-rays, no relative pins); no king
    safety yet; shown only while engine analysis is on.
- [x] **P2.4 Explanations in words** (its own topic; decided 2026-10-24: not tied to one paid
  provider). Facts (P2.3), threats (P2.2), what-if (P2.1) and human moves (P2.5) phrased as a
  short paragraph per move; a model never calculates.
  - [x] **P2.4a Programmatic explanation** (`feature/explanations`; owner review pending):
    templates over the computed facts and engine lines (`models/explain.ts`). Shown in the
    what-if card and for the selected key moment in the review, e.g. "Qg4 is a blunder: it gives
    away 40% of White's winning chances. It leaves the queen on g4 undefended and attacked.
    Black answers Bxg4. After Bxg4 f3: Black wins material (+9). Better was exd5."
    Known limits: from review data alone (no engine lines) only ~1 in 6 mistakes gets a
    reason beyond the verdict; static facts only (no tactics deeper than the lines played).
  - [x] **P2.4b Optional model provider** (`feature/model-explanations`, 2026-10-27):
    Settings → Explanations sets up Anthropic (default model claude-opus-5-5, any Claude
    model name; claude-haiku-5-5 suggested as far cheaper) or an OpenAI-compatible endpoint
    (Ollama, LM Studio, hosted). "Say it as a coach" under an explanation sends the computed
    text, nothing else, to `model_rephrase` (`src-tauri/src/model.rs`), which words it under a
    fixed system prompt; a rewording that names a move or square the explanation does not
    (`models/coach.ts`) is thrown away. The provider, endpoint and key are one keychain entry:
    changing the endpoint needs the key again, so a key is only ever sent where it was
    entered; endpoints are https, or http on localhost (no key needed). Anthropic requests use
    API version 2026-10-21, effort low, and server-side refusal fallbacks for models that have
    them; a refusal shows as an error. Checked in the app with a local qwen2.5:7b in Ollama.
    Not tried with a real Anthropic key.
  - [x] **P2.4c Explanations with their evidence** (owner's brief, 2026-10-27;
    `feature/explanation-contract`): research of ChessCoach, Lee et al. 2022, Queen 2026 and
    python-chess, the decision, and the contract in `docs/EXPLANATIONS.md`.
    `explainMoveFull` returns the structured result (scores for the mover, cp or mate, depth,
    replayed lines, evidence marked board / line / interpretation, limits, validation); a
    search below depth 10 judges nothing; a third repetition is said from the game's history;
    a board-only double attack is no longer called a fork; a model's wording is also refused
    when it adds a claim (fork, wins, mate…). The Engine section shows the evidence folded
    under the explanation. Review key moments and the tutor still use the text only.
  - [x] **P2.4d Evidence in review and the tutor** (owner's order 2026-10-27, first;
    `feature/evidence-everywhere`): the review's key moments and the tutor's questions use
    `explainMoveFull` with their scores (and depths) and the game's history
    (`gamePosition.positionsBefore`); the review shows the same Evidence panel
    (`ExplanationEvidence.tsx`, shared with the Engine section); the tutor's question gives no
    reason when its search was too shallow to judge (a material loss is only ever said from a
    played-out line). Checked in the app on a reviewed game; the tutor's question by hand.
  - [x] **P2.4e The engine sees the game** (second; `feature/engine-sees-game`): searches
    take a `history` option (`models/gamehistory.ts`: the game's start and moves, checked to
    lead to the position) and the UCI wrapper sends `position fen <start> moves …`. Used by
    the main analysis (also review and puzzle refutation; not threat mode, whose null move is
    no move), the review's moment lines (cache keyed by the game), the tutor's searches and the
    background review of synced games. Checked with Stockfish: after 1.e4 Nf6 2.Nc3 Ng8 3.Nb1
    Nf6 4.Nc3 Ng8 5.Nb1, the position alone gives −0.33 and c5, the game gives 0.00 and Nf6
    (the draw); in the app 5.Nb1 is called a mistake that repeats the position a third time.
    The "engine judged it without the game" note stays only for review scores, which may come
    from a review run before this.
  - [x] **P2.4f Strategic explanations, measured** (third, one idea at a time; done 2026-10-28,
    five kept and pawn breaks dropped): each a rule with
    tests and a check by hand against annotated games (`PGN_FILE` in `pnpm eval:reasons`), or
    against Stockfish's piece values where no annotated games cover it, kept only if it holds
    up, its evidence marked as interpretation. In order: the bad bishop, weak squares (holes the
    opponent can use), space, pawn breaks and the plans they open, prophylaxis beyond stopping a
    direct threat, endgame technique (king activity, the opposition). Ideas that cannot be
    supported are listed here as dropped, with why.
    - [x] The bad bishop (`feature/bad-bishop`, 2026-10-27): own pawns fixed on its colour,
      the bishop behind them with at most 3 squares; Stockfish values it below its partner in
      67-72% of puzzle positions (52-58% for fixed pawns alone), and its veto applies when piece
      values are known. Details in `docs/REASONS.md`.
    - [x] Weak squares (`feature/weak-squares`, 2026-10-27): a pawn move that leaves a hole
      (no pawn can cover the square any more), said only as a cost of a bad move. Measured
      on real games (Lichess, 2013, CC0): hole-making pawn moves are worse than the other pawn
      moves of the same position in 69-72% of balanced positions, +3 points of loss; the
      textbook d/e-file hole alone shows no signal (documented).
    - [x] Space (`feature/space`, 2026-10-28): a central pawn to the fifth rank that no enemy
      pawn attacks gains space; better than the position's other pawn moves in 60-61% of
      balanced positions (two batches), steadier than Stockfish's former space count (58-64%
      at +3 squares, nothing below). Said as an interpretation among a good move's reasons.
    - [-] Pawn breaks (`feature/pawn-breaks`, 2026-10-28): dropped as a reason. A quiet pawn
      move that attacks an enemy pawn is no better than the position's other pawn moves when
      defended (46-50% on two batches) and worse when not (39-44%, the pawn is lost): a break's
      worth is its timing and plan, which one move does not show. Saying "a pawn break" would
      imply praise the data does not support; breaks the engine likes are explained by their
      threats and lines. The measurement stays (`-t "pawn breaks"`) for a later, plan-aware try.
    - [x] Prophylaxis (`feature/prophylaxis`, 2026-10-28): the opponent's wanted move (their
      null-move line, already searched for stopped threats, when it is no threat) taken away
      by a pawn now covering its square, as h3 against …Bg4. Better than the position's other
      quiet moves in 78-79% of balanced positions (two batches of 2000). Taking it away
      otherwise (no longer legal, the piece left undefended) is worse, 32-47%, and is not said.
    - [x] Endgame technique (`feature/endgame`, 2026-10-28): in an endgame (no queens, at most
      four pieces) a king move towards the enemy pawns, or towards the centre while pieces
      remain, beats the position's other king moves in 70-78% of balanced endgames, at depth
      10 and 16; in king and pawn endgames the centre alone shows nothing at depth 16 and is
      not said. The direct opposition in pawn endgames: 57-72%, said; the distant opposition
      and "the king up the board" did less well and are not.
  - [x] **P2.4g Study Chesserly** (owner's request 2026-10-27; done 2026-10-28,
    `feature/chesserly`): found at github.com/sekhniashviligiorgi21/Chesserly, MIT. Its classes
    and accuracy, compared, are in `docs/EXPLANATIONS.md`; it explains no move in words. Four
    ideas taken as items: P2.4h, P2.4i, P1.5, P1.6; no code. Read the source code and the
    ideas behind Chesserly, a free, open-source analysis platform (game review, move
    classification from Brilliant to Blunder, accuracy, openings; Vue, FastAPI, Stockfish,
    python-chess, per its [listing](https://hunted.space/product/chesserly)). First find its
    repository (the listing links a GitHub page the search did not show) and its license. Then
    compare with ReChess: how it classifies moves (especially "Brilliant" and "Great"), how
    accuracy is computed, and whether it explains moves in words and how; report what is worth
    taking over (ideas, or code if the license allows; ReChess is GPL-3.0) in
    `docs/EXPLANATIONS.md`, with links.
  - [x] **P2.4h The only good move** (`feature/only-move`, 2026-10-28): `reasons/onlymove.ts`
    from a MultiPV 2 search on the explainer engine (`explainAlternatives`, cached), in the
    Engine section and the review's key moments: "It is the only move that keeps the balance:
    every other move gives away at least 21% of White's winning chances (the next best is
    d4)", or for a mistake "Only Ne7 kept the advantage: …". Evidence from the lines, said
    from depth 10. Fires in 7% of game positions at depth 16 (`ONLY_MOVE=1000`, 1,000
    positions: 35 advantage, 33 balance, 4 damage, 2 mate). The explainer's searches now send
    MultiPV every time (the tutor's multi-line search left it set). When the move played is the
    engine's and the second-best line gives away 10 points of winning chances or more, say
    so as evidence from the lines ("the only move that keeps the balance: the next best, Bd3,
    gives away 14%"). Not for a recapture or taking a free piece. Uses the analysis's
    MultiPV lines when there are two, else one extra search. Done when: tested on positions
    with one good move and with several, and shown in the Engine section and review.
  - [x] **P2.4i Sacrifices** (`feature/sacrifices`, 2026-10-28): `reasons/sacrifice.ts`, said
    when the opponent takes two pawns' worth or more at once, the piece taken is the one that
    moved or one not attacked before, and the line wins it back or mates. Puzzles: precision
    0.99 against the `sacrifice` tag; games, by hand: every one found (9 in 4,000 positions)
    a real sacrifice. For the move played and the better move after a mistake. Details in
    `docs/REASONS.md`. The engine's best move gives up
    material that its line wins back, or pays for with mate or a lasting edge; read from the
    line (`lineOutcome`), not a static exchange count. Measured like P2.4f (on puzzles tagged
    `sacrifice`?) before it is said; dropped with why if it does not hold up.
- [x] **P2.5 Human vs best** (`feature/human-moves`; owner review pending): Maia's most likely
  move next to the engine's best, to show traps and "natural but wrong" moves.
  - Status: a Maia profile runs next to the analysis engine (`useHumanMoves`, Lc0
    VerboseMoveStats policy from `go nodes 1`) and the panel shows "maia-1500: Nf6 33% · Bc5 21%
    · h6 13%", starring the engine's choice and warning "Trap: most players play X, which loses
    N% winning chances" (`models/human.ts`). Settings: "Human moves in analysis" (automatic,
    off, or a profile).
  - Refactor: `startEngine(profile)` shared by analysis and human moves; `info string` lines are
    a separate UCI event; UCIEngine has tests with a fake process.
  - Known limits: a trap is only detected when the natural move is among the engine's MultiPV
    lines; otherwise the panel says the engine does not rank it.
- [x] **P2.6 Candidate-move trainer** and **P2.7 Guess the move** (`feature/guess-the-move`;
  owner review pending): commit to up to 3 candidates before the reveal; track how often the
  best move was among them.
  - Status: "Guess the move" in the game toolbar opens `/guess` for the file (pick the game and
    side; the side defaults to yours). Moving a piece adds a candidate (blue arrow); Reveal shows
    the game move, the engine's best and each candidate's score and loss (UCI `searchmoves`);
    a candidate within 2 win-% points of the best counts as finding it. The score line counts
    best and game moves found. `models/guess.ts`, `engine/search.ts` with tests.
  - Known limits: scores are kept for the session only (no history of training results);
    promotion candidates are always queens.
- [x] **P2.8 Reasons in chess terms** (requested by the owner 2026-10-25; research first;
  done 2026-10-26, merged; on `feature/reasons-pins-values` 2026-10-27: pins brought up to
  the bar and named, and SF17 piece values in the positional reasons ("improves the knight:
  Stockfish's piece values put it 2.1 higher on d5 than on e3"), see `docs/REASONS.md`).
  - Status 2026-10-26: research done, report in `docs/REASONS.md` (prior work, the kinds of
    reasons and how to compute each, a measuring harness `pnpm eval:reasons` against the
    Lichess puzzle themes with a baseline, and the plan R1–R5). Building starts with R1.
  - R1 done 2026-10-26: `src/reasons/motifs.ts` (mate and named mates, double check, fork,
    pin, skewer, discovered attack, hanging piece, promotion; ranking), tested, measured on
    40,000 puzzles: all but pin meet the bar or are right where the tags miss (see the report).
    Pins stay out of explanations until they improve. Next: R2 (threats prevented/created).
  - R2 done 2026-10-26: `src/reasons/threats.ts` (what a move stops and threatens, named with
    the motifs, in words) and `src/engine/threatsearch.ts` (the two short null-move searches),
    tested, checked by hand with Stockfish on real puzzles. Next: R3 (positional reasons), or
    R4 first to show R1–R2 in the app.
  - R4 done 2026-10-26 (before R3, by the owner's choice): explanations in the Engine section
    and the review's key moments name ideas ("It stops Qxf7#", "White answers Nxf7, a fork of
    …"); a background explainer engine runs the extra searches. Next: R3.
  - Moves and squares in explanations light up on the board when hovered (owner's request).
  - R3 done 2026-10-26: `src/reasons/positional.ts` (development, castling, centre, open files,
    passed pawns, outposts, activity, the king's pawn shield, isolated pawns), tested, checked
    against annotated games; good moves say what they build, quiet bad moves what they cost.
    SF17 piece values added 2026-10-27. Next: R5 (the tutor, P2.9).
  Say *why* a move is good or bad the way a coach would: "it stops the knight from reaching
  f7", "it pins the bishop and wins it next move", "after this the back rank is weak",
  instead of "it gives away 10% of winning chances". Today's explanations (P2.4a) give the
  verdict, static facts (hanging, pinned) and the refutation line, but rarely the idea.
  - Research to do (a short report in `docs/` before building):
    - What the move *prevents*: the opponent's threat before and after it (P2.2's null-move
      search), named ("Ng5 was threatening Nxf7, forking queen and rook").
    - What it *threatens or prepares*: the engine line's next moves, read for a motif.
    - The *motif* in a line: fork, pin, skewer, discovered attack, double check, back-rank
      mate, overloaded or removed defender, deflection, decoy, trapped piece, zwischenzug,
      promotion. Small, tested detectors over the positions of the engine's lines.
    - *Positional* reasons when there's no tactic: piece activity (mobility), king safety
      (attackers near the king, open files), pawn structure (passed, isolated, doubled,
      weak squares, outposts), development, space, exchanges that favour one side.
    - The *role* of the move: defence, prophylaxis, attack, development, simplification,
      improving the worst piece.
    - Prior work to read: move-by-move commentary generation (e.g. Jhamtani et al. 2018,
      "Learning to Generate Move-by-move Commentary for Chess Games"), concept probing of
      engines (McGrath et al. 2022 on AlphaZero), how human coaches and books phrase
      reasons, and the Lichess puzzle theme vocabulary.
  - A way to measure it: the Lichess puzzle set (P3.3) tags every puzzle with its themes
    (fork, pin, skewer, backRankMate, …). Run the detectors on the puzzles' solutions and
    compare with the tags (precision/recall) before trusting them in explanations.
  - Then: templates that turn detected reasons into sentences (extending `models/explain.ts`),
    shown in the Engine section and the review; optionally a model to phrase them better
    from the structured facts (P2.4b), never to calculate.
- [x] **P2.9 Tutor mode when playing** (requested by the owner 2026-10-25; done 2026-10-26,
  merged; owner testing pending): the engine plays
  at your level and coaches during the game.
  - Strength: "as bad as needed". Pick the engine's move by a target winning chance near
    your level (from the engine's MultiPV lines), sometimes a human-like mistake (Maia's
    policy, P2.5) rather than random blunders; your level from your games and puzzle rating,
    adjusted as you play.
  - Coaching, by what the position needs:
    - an immediate real threat against you: "Watch out: your queen is attacked" (P2.2);
    - a decisively good move available: "There's something strong here", then a hint on
      request (the piece, then the square), not the move outright;
    - your move drops a lot of winning chances: "Are you sure?" with the reason (P2.8)
      and "Take it back?";
    - the engine's own deliberate mistake: a chance for you to spot it.
  - Settings: level (or automatic), how chatty the tutor is, take-backs allowed; a short
    summary after the game (best moments, the mistakes, what to train).
  - Builds on P2.1–P2.5, P2.8 for the reasons, and the Play screen (no clocks in tutor mode).
  - Status 2026-10-26 (`feature/tutor`), steps T1–T3 done:
    - T1 `models/tutor.ts` (tested): the move for your level (a loss allowance and a target
      win chance from your rating, so it eases off when winning), deliberate believable
      mistakes (10–30% loss, never a collapse), when to ask about your move (by chattiness:
      only blunders / mistakes / every slip), a move that stands out, hints in steps (the
      piece, then the square).
    - T2 `components/game/useTutor.tsx`: plays the engine's moves from 6 candidate lines on
      the background explainer engine (the normal engine stays out of the game); judges your
      move from the same search; checks your turn for a standout move and the opponent's
      threat (null move).
    - T3 Play screen: Tutor switch, your level, what it asks about; the tutor's panel with
      "Are you sure about Ba6? It leaves the bishop on a6 undefended … Black answers Nxa6 …"
      and Take it back / Keep my move, "There's something strong here" with Hint / More,
      "Watch out: White threatens …", and "I've just made a mistake. Can you find how to take
      advantage of it?". No clock in tutor games; the opponent is "Tutor" with your rating.
    - T4 done: when a game ends (a result or a resignation) the tutor's panel sums it up:
      the result, your costliest moves and what they allowed, strong moves you found or
      missed, and buttons to train those themes (a Lichess puzzle of the theme near your
      puzzle rating). "Your level: Automatic" (setting `tutor.auto`, on by default) moves the
      level up 100 after a win (or a clean draw) and down 100 after a lost game with two or
      more mistakes (600–2200). Take-backs leave no trace in the summary.
    - Done 2026-10-27 (`feature/tutor-start-level`): until a tutor game has set it, the
      automatic level starts from the Lichess puzzle rating, 300 below it in steps of 100
      (puzzle ratings run above playing strength), once 20 puzzles have been tried (setting
      `tutor.levelFrom`: default, puzzles, games).
    - Left for later: starting the level from online games, and a tutor for the opening
      (repertoire) phase.

## Phase 3: databases and imports

- [x] **P3.1 Game database** for large PGN files (TWIC, Lichess elite, Lumbra), with search by
  player, opening and position. Decided 2026-10-24: SQLite for everything, SurrealDB removed.
  - [x] **P3.1a Move storage to SQLite** (`feature/sqlite`): puzzles and history in
    `rechess.sqlite`, versioned schema, weights computed on pick (same formula, no hourly cache);
    `tools/surreal-export` + one-time import keep old data (done for the owner's data: 1 game).
    The SurrealDB-only stubs and the `/db` test page are gone; no more LLVM to build.
  - [x] **P3.1b Game database** (`feature/game-database`; owner review pending): import large
    PGN files (.pgn, .pgn.zst) from the Databases page with progress; search by player, ECO,
    result, minimum Elo and position (first 30 plies indexed by Zobrist hash, with the next
    move for the explorer); open a game, Save copies it to `Library/From databases`; "Find this
    position" button next to the analysis switch. ~14,000 games/s, ~3 KB per game on disk
    (7,641 chess.com games: 0.54 s, 22 MB; a position search 7 ms).
    Known limits: comments and variations are not kept; Chess960 games are skipped; no
    cancel during an import; .zip files must be unpacked first.
- [x] **P3.2 Lichess puzzle database** (`feature/lichess-puzzles`; owner review pending): import
  by theme and rating range into the puzzle trainer.
  - Status: Puzzles page → "Download from Lichess" (or "Import file…"), popular puzzles
    (popularity ≥ 90: 3.3 M, ~720 MB, 11 s to import) or all (6.2 M, ~1.4 GB, 21 s). Train by
    theme within ±150 of your puzzle rating (Elo, K=32, first try only, as on Lichess); "Your
    weakest themes" from your attempts, each with a Train button; picking takes ~0.1 ms.
    Puzzles play in the puzzle screen (set-up move automatic, board facing the solver).
  - Known limits: only Lichess's exact solution is accepted (Lichess also accepts any mate in
    mate-in-1 puzzles); no cancel during download.
- [x] **P3.3 Opening explorer**: own database first, Lichess explorer online.
  - [x] Own databases (`feature/explorer`; owner review pending): Explorer tab next to Moves and
    Evaluation; moves played from the current position with counts, a White/draw/Black bar and
    average Elo, click to play; the games that reached the position underneath. Transpositions
    by hash; a game counts once per move. 5 ms at the start position for 7,641 games (grows
    linearly: about 0.5 s for a million). Only the first 30 plies of each game are indexed.
  - [x] Lichess explorer (`feature/secrets`; owner review pending): "Lichess: masters" and
    "Lichess: online games" in the Explorer's source list. Its API needs the user's personal
    Lichess token (401 without one since 2025-26), saved in Settings and kept by S.1.
- [x] **P3.4 Opening books** (`feature/opening-books`; owner review pending): Polyglot `.bin`
  support in analysis and as engine-play book. Settings → Opening books imports books into
  `<AppLocalData>/Books` (none shipped: licensing); each book is a source in the Explorer tab
  (moves with their weight share, click to play); Playing Settings → Opening book makes the
  engine play a weighted-random book move while the position is in the book. `books.rs` reads
  books with a binary search on disk (Polyglot keys = shakmaty Zobrist64; castling stored as
  king-takes-rook); checked on python-chess's performance.bin.
- [x] **P3.5 Endgame tablebase** lookups (`feature/tablebase`; owner review pending): with 7
  pieces or fewer, the analysis shows the exact result ("White wins: mate in 11", draws under
  the 50-move rule explained) and every move coloured win / draw / loss for the side playing it,
  click to play. Lichess tablebase (Syzygy, free, no token), cached per position; needs the
  network. `models/tablebase.ts` with tests.
- [x] **P3.6 Repertoire builder and trainer** (`feature/repertoire`; owner review pending):
  spaced repetition over your own lines (Chessable-style), fed from PGN.
  - Status: any Library PGN (all its games/chapters, with variations) becomes a repertoire via
    "Repertoire for White/Black" in its toolbar. Every position where it is your move is a card
    (any repertoire move there counts); Leitner boxes 1, 3, 7, 14, 30, 90 days, a mistake goes
    back to box 1. Training goes line by line: opponent moves play themselves, new moves are
    shown with an arrow, a wrong move shows the right one; lines with most due cards first.
    Repertoires page lists due/new counts. `models/repertoire.ts`, `repertoire.rs` with tests.
  - Known limits: cards are keyed by file path (renaming the file restarts its training); the
    editor is the normal game editor (no dedicated "add move to repertoire" mode yet).

## Phase 4: recognize positions

- [x] **P4.1 Paste a screenshot** (`feature/scan-position`; confirmed by the owner): Cmd+V or an
  image file → FEN → board editor for correction.
  - Status: fenshot 0.1.5 (MIT, CNN tile classifier, 1.3 MB) under onnxruntime-web 1.26,
    entirely local and single-threaded. Pasting an image anywhere outside a text field opens
    "Scan position"; the read lands in the board editor with warnings when unsure or illegal;
    then Analyze, Play from here or Find in databases. Boards seen from Black are turned round;
    the side at the bottom moves by default. Tested end to end on two real images (a diagram,
    a Lichess screenshot from Black's side) with the real model.
  - CSP: added `script-src 'self' 'wasm-unsafe-eval'` (WebAssembly) and `blob:` images.
  - Known limits: 2D boards only (no photos of real boards, no 3D sets).
- [x] **P4.1b Scan from screen** (`feature/screen-capture`; confirmed by the owner): "Capture from
  screen" on the Scan page; drag a rectangle over any board on screen (any app or website) and it
  opens recognized. macOS: the system region capture (`screencapture -i`) while ReChess hides;
  checks the Screen Recording permission first and explains how to grant it. Windows: later
  (Win+Shift+S and paste meanwhile). macOS keeps the permission only for signed builds
  (`pnpm build:mac`, see README); ad-hoc builds are new apps to it after every rebuild.
- [x] **P4.2 FEN / PGN from pasted text** (`feature/paste-text`; owner review pending): pasted
  anywhere outside a text field, a FEN (or a bare board) opens in analysis, a PGN (one or many
  games) opens in analysis with Save copying it to `Library/Pasted`, and a Lichess game link
  downloads that game (with clocks and evals when analysed). `src/paste/` with tests.
  chess.com game links are not supported (no public single-game API).
- [x] **P4.3 Books and PDFs** (`feature/scan-book`; owner review pending): detect diagrams on
  pages and batch-convert them into a puzzle collection.
  - Status: Scan → "Scan a whole book…": a PDF (pdf.js 6, rendered in the webview) or page
    images, a page range, then every diagram per page: square blobs of ink are found first and
    each is read on its own, scaled to ~520 px (fenshot's line search alone pairs one board's
    columns with another's rows on multi-diagram pages). Review cards (thumbnail, page,
    warnings, whose move, include); Save writes `Library/Scanned/<book>/pNNN-i.pgn`, optionally
    solved by the engine (best move) and registered as puzzles; "Train these puzzles".
  - Checked end to end in Node (pdf.js + @napi-rs/canvas + the real model) on generated A4
    PDFs: flat-coloured diagrams read at any render size 1400–2800 px; finely hatched
    diagrams only near their native size, so pages render at 2000 px with a fallback read at
    the rendered size.
  - Known limits: the side to move is a guess (the side at the bottom); the engine solution is
    one move; very ornate or 3D diagrams are not read.
- [x] **P4.4 Read PDFs in the app** (`feature/pdf-reader`; owner review pending; requested
  2026-10-25): keep chess PDFs in the Library and read them in a viewer.
  - Status: "Add PDF…" in a Library folder copies a PDF in; PDFs are listed (and in the
    sidebar tree) and open in `/reader`: pages render as they scroll into view (sharp on
    retina, dropped when far away), page number / previous / next, zoom, "Find in the book"
    (pages whose text matches), the last page read is remembered per book. Diagrams on visible
    pages are found in the background (one page at a time) and outlined (dashed when unsure);
    a click shows the position beside the page with whose move, Analyze, Play from here, Find
    in databases and Edit (the board editor now takes `?fen=`).
  - Known limits: scanned (image-only) PDFs have no text to find; pages are assumed to share
    the first page's shape for the placeholders.
  - Fix (`fix/book-diagrams`; confirmed by the owner 2026-10-25): framed book diagrams were
    missed or outlined a few pixels off with misread pieces; the board is now also taken from
    inside its frame. How recognition works and what to improve: `docs/SCANNING.md`.
  - Follow-ups (requested 2026-10-25):
    - [x] **P4.4a Remember the reading position** (`feature/reader-position`; owner review
      pending): the page, how far down it the view starts and the zoom, per book, in the
      `reader.places` setting (older `reader.pages` entries are still honoured). Zooming and
      resizing the window keep the same place at the top instead of jumping.
    - [x] **P4.4b Select text** (`feature/reader-text`; owner review pending): pdf.js's text
      layer (invisible, selectable text) over each visible page; Cmd/Ctrl+C copies. It scales
      with the page through `--total-scale-factor`, so zooming needs no redraw. Scanned
      (image-only) PDFs have no text to select.
    - [x] **P4.4d Edit the PGN associated with a position** (`feature/reader-notes`, reworked
      in `feature/reader-side-notes` after owner feedback 2026-10-25: notes beside the book,
      in the PGN editor): clicking a diagram opens its notes in the reader's side panel, in
      the same editor as PGN files (`GameManager` with `compact`: board above the moves). The
      notes are the diagram's own PGN (`Library/Scanned/<book>/pNNN-i.pgn`, the same file
      "Scan a whole book" writes), saved automatically once something is added; until then
      the side to move can be changed. Diagrams with notes get a corner mark. The app leaves
      the book only for Analyze (the notes file once there is one), Play from here, Find in
      databases and Edit. Known limits: notes are matched by page and diagram order on the
      page, so recognition that finds an extra diagram on a page shifts the numbering; a
      misread (illegal) position gets no notes until corrected.
    - [x] **P4.4c Copy text into annotations** (same branches): "Add selected text as a
      comment" adds the last text selected on the pages as a comment on the move shown in
      the notes, on one line (line-end hyphenation undone) with "(p. N)".
    - [x] **P4.4e Positions and moves from the text** — **needs work** (owner, 2026-10-25:
      "From the text" looks right so far, more testing to come) (`feature/reader-side-notes`;
      `src/models/booktext.ts` with tests): the side to move comes from the
      caption under the diagram ("White to play", "Black wins") or the first move number in
      the text below ("12...Nf6" → Black), falling back to the side at the bottom. Moves in
      the text below the diagram that can be played from it are shown ("From the text: 4.c3
      Nf6 5.d4") with "Add these moves"; "Add selected moves" plays a selected move sequence
      from the move shown in the notes (or from the diagram). SAN with figurines, castling
      with zeros, evaluation signs; bracketed side lines are left out; words between moves
      end a line, so squares in sentences aren't taken for moves. A selection shows what it
      would add as moves ("As moves: …", from the move shown in the notes) before "Add as
      moves" / "Add as a comment". Known limits: the "text below" is the diagram's column
      down to 30% of the page, so text continuing on the next column or page is not read.
    - [ ] **P4.4f Read piece icons in the text** (future improvement, owner 2026-10-25: "move
      reading has difficulties with icons"). Books print pieces with chess-font figurines,
      which reach the PDF's text as arbitrary characters, or not at all. Today a move after
      an unreadable symbol ("f3") is tried as each piece, the same symbol standing for
      the same piece throughout a line, and the reading that plays longest wins (ties stop
      the line). A dropped symbol can't be told from a pawn move ("2 Nf3" read as "2 f3").
      Ideas: learn each book's font mapping (the font name and glyph codes from pdf.js's text
      content, or confirm it once with the user); read the glyphs' shapes with the tile
      model; prefer the piece reading when a pawn move "fits" but breaks the line later.

## Integrations

- [x] **I.1 YouTube** (`feature/youtube`; owner review pending): attach a video with a timestamp
  to a position (PGN comment), play it in an embedded player. The YouTube button in the editor
  toolbar takes a link and a start time and adds `https://youtu.be/ID?t=123` as a comment on
  the move shown (a plain link, readable in any PGN tool). Any YouTube link in a comment, also
  in imported PGNs, shows as a "▶ 2:03" chip; a click plays it in a floating player
  (youtube-nocookie.com embed; CSP `frame-src https://www.youtube-nocookie.com` only) that
  stays open while you move through the game. "Open in browser" (Rust `open_youtube`, which
  builds the URL from a checked video id) is the fallback: YouTube may refuse to play embedded
  in an app not served over http(s) (macOS Tauri's `tauri://`). `models/youtube.ts` (tested),
  `components/video/`.
- [-] **I.2 Chessable**: no public API; courses only export to chess.com. Covered by P3.6 with
  PGNs the user owns.
- [ ] **I.3 "Open in ReChess" from the browser** (decided 2026-10-24: later): register a
  `rechess://` link (Tauri deep-link plugin) such as `rechess://analyze?fen=…`, plus a bookmarklet
  that reads the position Lichess / chess.com already keep as text in the page, so no image
  recognition is needed there.
- [-] **I.4 In-app web browser** for scanning boards: an external page cannot be given the app's
  access, most boards are drawn from page elements rather than images, and it would be a
  second-rate browser. Covered by P4.1b (scan from screen) and I.3.

## Shared foundations

- [x] **S.1 Secret storage** (`feature/secrets`; owner review pending) for the Lichess token
  (P3.3) and model API keys (P2.4b): `secrets.rs` keeps them in the OS keychain (macOS Keychain,
  Windows Credential Manager, `keyring` 3.6). The webview can save, delete and ask whether one is
  set, never read one; Rust adds them to requests. Only named secrets (`lichess_token`; add the
  model key with P2.4b). Unsigned builds may get one keychain prompt per build.

## Other

- [x] **O.1 Eval graph** in analysis: done with P1.2, the clickable graph in the Evaluation
  tab (from the review's or the PGN's `[%eval]`).
- [x] **O.2 Keyboard-driven analysis** (`feature/keyboard`; owner review pending): ← → (or
  K J) previous/next move, ↑/Home start, ↓/End end of the line shown, Shift+↑/↓ previous/next
  variation, F flip the board (as the Flip Board button, saved in the PGN's `Orientation`;
  only the view while playing or in a puzzle), L engine on/off, X threat,
  Space play the engine's best move, ? the shortcuts dialog. Keys typed in text fields and
  keys with Cmd/Ctrl/Alt are left alone; moving through the game is off while playing the
  engine or solving a puzzle. In the PDF reader the notes take keys only after a click inside
  them. `models/shortcuts.ts` (tested) + `components/game/useShortcuts.tsx`.
- [x] **O.3 Arrows and highlights** saved to PGN (`[%cal]`, `[%csl]`): already done; shapes
  drawn on the board (right-drag) are stored on the move (`GameModel.updateShapes`).
- [x] **O.4 Clocks** and time controls when playing (`feature/clocks`; owner review pending):
  "Time control" on the Play page (no clock, 1+0, 3+2, 5+3, 10+5, 15+10, 30+20; setting
  `engine.playing.timeControl`) applies to the next game. Both clocks show above and below
  the board (the running one highlighted, red under ten seconds); Fischer increment; a flag
  fall ends the game (a draw if the other side cannot mate). The engine plays on its clock
  (`go wtime btime winc binc` instead of depth/movetime). The PGN gets `[TimeControl]` and
  `[%clk]` on every move, so History keeps the times. `models/clock.ts` (tested),
  `components/game/useGameClock.tsx`. Not yet: pausing, different times per side, the
  playing strength's own time limits (Maia/single-node profiles answer instantly anyway).
- [x] **O.5 Board image / GIF export** (`feature/board-export`; owner review pending): three
  buttons next to Flip Board: copy the board as an image, save it as a PNG (800 px), save the
  line shown as an animated GIF (400 px, a move a second, from the start through the move
  shown and on to the end of its line). Drawn on a canvas with the board and piece theme in
  use (read from a hidden board), last move highlighted. Files are written by a Rust command
  (`export.rs`, `export_save`) that opens the save dialog itself and takes the bytes raw, so
  the webview's fs scope stays as it is. `gifenc` (MIT) encodes GIFs. Pure parts tested
  (`models/boardframes.ts`, `export.rs`). Not yet: arrows/circles and coordinates on the
  image, choosing the GIF's size and speed.
- [x] **O.6 Backups** of Library and database (`feature/backups`; owner review pending;
  auto-update moved to the end of the roadmap, X.1, on 2026-10-25). Settings → Backups:
  "Back up now…" (a zip where you choose, PDFs and opening books included), "Restore from a
  backup…", "Open the Backups folder", and an automatic backup once a day (on by default,
  30 s after start, `<AppLocalData>/Backups/auto-*.zip`, the last seven kept, no PDFs or
  books). A backup has the Library, Themes and History folders, settings.json, and the
  user's own tables (puzzles, history, puzzle_attempts, repertoires, repertoire_cards) as a
  small SQLite file; imported game databases, the position index and the Lichess puzzle set
  are left out (re-importable, and large). Engines are never in a backup: `engines.json`
  names executables the app may run. Restoring backs up the current data first
  (`before-restore-*.zip`), replaces the tables, and copies the files over (files not in the
  backup are kept). Zip entries are confined to the known folders (no path escapes).
  `src-tauri/src/backup.rs` with tests, `components/settings/Backups.tsx`.
- [x] **O.7 CI** (`feature/rust-ci`): a `rust` job on macOS and Windows runs `cargo fmt
  --check`, `cargo clippy --all-targets -- -D warnings` and `cargo test` (cached with
  rust-cache; the frontend is built first because Tauri embeds `dist`). Checked locally on
  macOS; Windows is confirmed by the first CI run. (Vitest runs in CI since P1.2.)

## Known refactor targets (do them when touching the code)

- [x] Split `GameManager.tsx` (`feature/split-gamemanager`, 2026-10-27): puzzle mode in
  `usePuzzle`, the board config in `boardConfig.ts`, moves and promotion in `useMoveInput`,
  the parent API in `gameApi.ts`, the board column in `BoardArea.tsx`; GameManager keeps
  the state, the PGN sync, the engine, clock and tutor wiring (1117 → 675 lines).
- [x] `useChessEngine` as an explicit state machine (`feature/engine-state-machine`,
  2026-10-27): `engine/enginetask.ts` decides the one task (idle, review, refutation,
  threat, analysis, play) and its search, with tests; a bestmove is handled by the task its
  search was started for, so an engine move that arrives after the game stopped or the
  position changed is dropped.
- [x] Typed settings schema (`feature/typed-settings`, 2026-10-27): `getSettingValue` and
  `setSettingValue` take only paths of `AppSettings` and return or take that path's type
  (`SettingPath`, `SettingValue` in settings.ts); the casts at call sites are gone. Four keys
  in use were missing from the interface (`engine.threads`, the two movetimes,
  `layout.panel`); their defaults are now in DEFAULT, which fixes the move-time sliders
  showing 1 s on a fresh install while the engine used 10 s.
- [x] Split `components/common/utils.tsx` (`feature/split-utils`, 2026-10-27): chess helpers
  in `models/chessutil.ts` and formatting in `models/format.ts` (both tested), the board's
  base config and shapes in `common/boardShapes.ts`, the position shown in
  `game/gamePosition.ts`, loading a game in `game/gameInit.ts`, `useSplitter`, `editing.ts`
  (paste, select all), `figurines.tsx`, and `useFenTooltip` beside `useTooltip`. Unused
  helpers dropped (`toDests`, `toOrientation`).
- [x] Delete dead code listed in CLAUDE.md (already gone: `Views/obsoleted`, `GameEditView`,
  `components/Analysis.tsx`, `FENcoder.ts`, the Rust `greet`; checked 2026-10-27).

## UX overhaul (requested 2026-10-24, after the feature work above)

- [x] **U.1 UI overhaul for a better user experience** (steps 1–8 done and merged by
  2026-10-26, plan and log in `docs/UX.md`; still open: splitting `GameManager.tsx`, a contrast
  pass on the newest screens). Many features were added quickly, each
  in its own corner; this pass makes the app feel like one product. Proposed scope, to agree on
  before starting (a short design doc with mock-ups first):
  - **Information architecture**: a home/dashboard with what to do today (repertoire reviews
    due, mistakes to train, new synced games to review), and a sidebar grouped by purpose
    (Play · Train · Study · Games) instead of one flat list.
  - **One analysis screen**: engine lines, what-if, threats, facts, human moves and explorer
    as coherent, collapsible panels with sensible defaults, instead of stacked boxes.
  - **Consistency**: one design for toolbars, buttons, forms, empty states, loading and errors;
    toasts styled (also in builds); dark and light themes checked.
  - **Board**: responsive sizing everywhere (several pages size it by hand), drag-and-drop and
    click-to-move everywhere, move/arrow animations, sound settings.
  - **Resizable panels** (requested 2026-10-25): drag the dividers between panels (e.g. the
    PDF reader's pages and notes, board and moves) and remember the sizes per screen. The game
    editor's `useSplitter`/`VDivider` is a starting point.
  - **Discoverability**: onboarding for first start (engine setup, sync an account, import
    puzzles), tooltips/shortcuts help (with O.2), clear naming (e.g. "studies" vs files).
  - **Accessibility**: keyboard navigation, focus states, contrast, screen-reader labels.
  - **Cleanup on the way**: split `GameManager.tsx`, the old `Views/obsoleted` pages, unused
    routes and dead code.

## Last

- [~] **X.1 App auto-update** (moved here from O.6 by the owner, 2026-10-25). Tauri's updater
  plugin checks a release feed and installs signed updates. Decided 2026-10-27: releases on
  this repository's GitHub Releases (the repository becomes public), macOS signed with a
  Developer ID and notarized. **Status** (`feature/auto-update`): the updater plugin with the
  feed `releases/latest/download/latest.json`, Settings → Updates (version, check now, check
  on start, notes, install and restart with progress), a check 20 s after start in built apps,
  and `.github/workflows/release.yml` (a `v*` tag → draft release for macOS arm64/x64 and
  Windows, updater bundles and latest.json; `tauri.release.conf.json` turns the bundles on,
  so local builds need no key). The app's version comes from `package.json`. **Owner steps
  left** (README, Releases and updates): generate the key and put the public half in
  `tauri.conf.json`, add the secrets, make the repository public, release twice to try an
  update. Windows installers are not code-signed.
