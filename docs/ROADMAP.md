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
- [ ] **P1.4 Auto sync and review** (optional): sync accounts on startup and review new games
  in the background.

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
- [ ] **P2.4 Explanations in words** (its own topic; decided 2026-10-24: not tied to one paid
  provider). Facts (P2.3), threats (P2.2), what-if (P2.1) and human moves (P2.5) phrased as a
  short paragraph per move; a model never calculates.
  - [x] **P2.4a Programmatic explanation** (`feature/explanations`; owner review pending):
    templates over the computed facts and engine lines (`models/explain.ts`). Shown in the
    what-if card and for the selected key moment in the review, e.g. "Qg4 is a blunder: it gives
    away 40% of White's winning chances. It leaves the queen on g4 undefended and attacked.
    Black answers Bxg4. After Bxg4 f3: Black wins material (+9). Better was exd5."
    Known limits: from review data alone (no engine lines) only ~1 in 6 mistakes gets a
    reason beyond the verdict; static facts only (no tactics deeper than the lines played).
  - [ ] **P2.4b Optional model provider**: OpenAI-compatible endpoint (free local models via
    Ollama / LM Studio, or cheap hosted ones) and Anthropic; key stored outside the webview.
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
- [~] **P3.3 Opening explorer**: own database first, Lichess explorer online.
  - [x] Own databases (`feature/explorer`; owner review pending): Explorer tab next to Moves and
    Evaluation; moves played from the current position with counts, a White/draw/Black bar and
    average Elo, click to play; the games that reached the position underneath. Transpositions
    by hash; a game counts once per move. 5 ms at the start position for 7,641 games (grows
    linearly: about 0.5 s for a million). Only the first 30 plies of each game are indexed.
  - [ ] Lichess explorer: its API answers 401 without a token since 2025-26, so it needs the
    user's personal Lichess token, stored with S.1.
- [ ] **P3.4 Opening books**: Polyglot `.bin` support in analysis and as engine-play book.
- [ ] **P3.5 Endgame tablebase** lookups (Lichess tablebase API).
- [ ] **P3.6 Repertoire builder and trainer**: spaced repetition over your own lines
  (Chessable-style), fed from PGN.

## Phase 4: recognize positions

- [ ] **P4.1 Paste a screenshot** (Cmd+V or screen region) → FEN → board editor for correction.
  Candidates: fenshot (MIT, in-browser), chessboard-recognizer; Claude vision as a fallback.
- [ ] **P4.2 FEN / PGN from pasted text** (web pages, chat).
- [ ] **P4.3 Books and PDFs**: detect diagrams on pages and batch-convert them into a puzzle
  collection.

## Integrations

- [ ] **I.1 YouTube**: attach a video with a timestamp to a position (PGN comment), play it in an
  embedded player. Needs a narrow CSP `frame-src` for youtube-nocookie.com.
- [-] **I.2 Chessable**: no public API; courses only export to chess.com. Covered by P3.6 with
  PGNs the user owns.

## Shared foundations

- [ ] **S.1 Secret storage** for the Lichess token (P3.3) and model API keys (P2.4b): kept by
  Rust (OS keychain or a file outside the webview's fs scope), never readable by the webview.

## Other

- [ ] **O.1 Eval graph** in analysis (shared with P1.2).
- [ ] **O.2 Keyboard-driven analysis** and shortcuts help.
- [ ] **O.3 Arrows and highlights** saved to PGN (`[%cal]`, `[%csl]`).
- [ ] **O.4 Clocks** and time controls when playing.
- [ ] **O.5 Board image / GIF export.**
- [ ] **O.6 Backups** of Library and database; app auto-update.
- [ ] **O.7 CI**: Rust `cargo check`/`clippy`. (Vitest runs in CI since P1.2.)

## Known refactor targets (do them when touching the code)

- Split `GameManager.tsx` (when adding review/explanation panels).
- `useChessEngine` as an explicit state machine (when adding background review).
- Typed settings schema (when adding new settings).
- Split `components/common/utils.tsx`.
- Delete dead code listed in CLAUDE.md.
