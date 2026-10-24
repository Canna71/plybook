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

- [ ] **P2.1 What-if mode**: play a candidate move in analysis and see the refutation line,
  with the material or mate it leads to.
- [x] **P2.2 Show the threat** (`feature/threat`; owner review pending): what the opponent would
  do if it were their move (null-move analysis), as an arrow and a line.
  - Status: the warning-triangle button next to the analysis switch searches the position with
    the other side to move; red arrows and a sentence ("Black threatens Nxf3+ (check, takes the
    knight on f3)"). Not available in check. `src/models/threat.ts` with tests.
  - Refactor: engine lines are built from the position the engine searched (`analyzedFen`), not
    the board, so stale infos no longer produce illegal lines; props destructuring fixed.
- [ ] **P2.3 Position facts**: hanging pieces, forks, pins, mate threats, king safety, material at
  the end of the PV, computed with chessops. Shown as short bullet points per move.
- [ ] **P2.4 Natural-language explanation** (optional, needs an API key): Claude phrases P2.3
  facts and engine lines; never asked to calculate. **Decision**: provider and key handling.
- [ ] **P2.5 Human vs best**: Maia's most likely move next to the engine's best, to show traps
  and "natural but wrong" moves.
- [ ] **P2.6 Candidate-move trainer**: commit to 2-3 candidates before the reveal; track how
  often the best move was among them.
- [ ] **P2.7 Guess the move** through master games or your own.

## Phase 3: databases and imports

- [ ] **P3.1 Game database** for large PGN files (TWIC, Lichess elite, Lumbra), with search by
  player, opening and position. **Decision**: SQLite with a position index (recommended) or
  SurrealDB. Replaces the `upload_pgn` / `index_game` stubs.
- [ ] **P3.2 Lichess puzzle database** (CC0 CSV): import by theme and rating range into the
  puzzle trainer.
- [ ] **P3.3 Opening explorer**: own database first, Lichess explorer online (check whether its
  API now needs a token).
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
