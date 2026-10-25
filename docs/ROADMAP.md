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
  - [ ] **P2.4b Optional model provider** (deferred by the owner on 2026-10-24; keep for
    later): OpenAI-compatible endpoint (free local models via Ollama / LM Studio, or cheap
    hosted ones) and Anthropic. The key goes in the keychain with S.1 (a new `Secret` variant).
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

- [ ] **I.1 YouTube**: attach a video with a timestamp to a position (PGN comment), play it in an
  embedded player. Needs a narrow CSP `frame-src` for youtube-nocookie.com.
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
  variation, F flip the board (new: there was no flip before), L engine on/off, X threat,
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
- [ ] **O.5 Board image / GIF export.**
- [ ] **O.6 Backups** of Library and database; app auto-update.
- [ ] **O.7 CI**: Rust `cargo check`/`clippy`. (Vitest runs in CI since P1.2.)

## Known refactor targets (do them when touching the code)

- Split `GameManager.tsx` (when adding review/explanation panels).
- `useChessEngine` as an explicit state machine (when adding background review).
- Typed settings schema (when adding new settings).
- Split `components/common/utils.tsx`.
- Delete dead code listed in CLAUDE.md.

## UX overhaul (requested 2026-10-24, after the feature work above)

- [ ] **U.1 UI overhaul for a better user experience.** Many features were added quickly, each
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
