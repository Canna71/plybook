# Things to test by hand

Features that pass the automated checks (typecheck, lint, Vitest, cargo tests, build) but have
not been tried in the running app yet. Test in a **built** app where noted (`pnpm build:mac`):
the CSP and signing only apply there. Tick an item when it's confirmed, note what went wrong
when it isn't, and remove ticked items once their roadmap entry says "confirmed by the owner".

## UX overhaul, step 1: look and themes (branch feature/ux-overhaul)

- [ ] **Overall look** in both themes: Settings → Appearance → Theme, try Light and Dark; walk
      through Analysis, Play, Puzzles, Databases, History, Settings. Anything unreadable,
      clipped or out of place?
- [ ] **Same as the system**: with "Same as the system", switching macOS between light and dark
      switches the app.
- [ ] **Board and pieces**: Appearance → Board / Pieces change the preview and every board.
- [ ] **Density**: text and buttons are smaller (14 px base). Comfortable, or too small?
- [ ] **Toasts** (built app): a toast (e.g. copy a board image) appears bottom right, in the
      theme's colours.
- [ ] **Dialogs**: Analysis Settings (gear in analysis): title bar, sliders with values on the
      right, Close on the right.

## UX overhaul, step 2: navigation (branch feature/ux-overhaul)

- [ ] **Sidebar**: the groups make sense; the highlighted entry follows you (open a game from
      Files: Library is highlighted; open a puzzle: Puzzles).
- [ ] **Collapse**: "Collapse" at the bottom turns the sidebar into icons (hover shows names);
      it stays collapsed after a restart; the expand button brings it back.
- [ ] **⌘K**: from any screen, also while typing in a field: type part of a screen, an action
      or a file name ("ital", "dark", "databases"), ↑ ↓ to choose, Enter opens, Esc closes.
- [ ] **Files**: the "Files" section folds and unfolds (remembered) and still opens games,
      folders and PDFs.
- [ ] **Headers**: Puzzles, History, Databases, Repertoires, Settings start with a title, a
      line on what the screen is for, and their buttons on the right.

## UX overhaul, step 3: Today (branch feature/ux-overhaul)

- [ ] **The tiles are right**: Openings shows the moves due in your repertoires ("Train" opens
      the one with most due); Puzzles shows your Lichess puzzle rating once downloaded;
      Mistakes counts positions from reviewed games.
- [ ] **Continue**: open a game and a PDF, come back to Today: both are listed, newest first,
      the book with its page; clicking opens them.
- [ ] **Get started**: ticks follow reality (e.g. link an account in Settings, come back);
      "Hide" removes the checklist for good.
- [ ] **Does it tell you what to do?** The real question of this step.

## UX overhaul, step 4: the analysis workspace (branch feature/ux-overhaul)

- [ ] **Board size**: resize the window (wide, tall, small): the board always fits, nothing is
      cut off; drag the divider: the panel changes width and keeps it after a restart.
- [ ] **Eval bar** (with Stockfish active): follows the evaluation as you step through moves,
      flips with the board, hidden while playing and in puzzles.
- [ ] **Toolbar**: Export and More menus open, do their thing, close on Esc or a click outside.
- [ ] **Sections**: fold and unfold Engine, About this position, Game review, Explorer; they
      stay that way after a restart; "Review the game" opens Game review with its progress.
- [ ] **Moves**: readable, side lines clearly set apart, the current move easy to spot.
- [ ] **PDF reader notes** still work in their side panel (they share this editor).
- [ ] **Play and puzzles** look right with the new layout.
- [ ] **Engines split**: with Maia as "Play against", analysis, game review, puzzles' hints and
      Guess the move still use Stockfish; playing uses Maia. Choosing another full-strength
      engine in the "Analysis" column switches analysis to it.

## UX overhaul, step 5: board editor and Scan (branch feature/ux-overhaul)

- [ ] **Board editor**: drag pieces from the trays and off the board; side to move, castling,
      en passant and the FEN stay in step; Flip swaps the trays too; Analyze / Play / Find
      open the position.
- [ ] **Scan**: capture or paste a board: the picture shows under the settings, next to the
      board; fix a square and Analyze.
- [ ] **Change the starting position** (analysis → More): the editor fits the board column;
      Accept and Cancel work.
- [ ] **Small window**: the editor drops to one column and scrolls.

## UX overhaul, step 6: the training frame (branch feature/ux-overhaul)

- [ ] **Puzzle, wrong move**: the frame turns red ("Not the move") with Try again; Try again
      puts the position back.
- [ ] **Puzzle, right move then solved**: "Good move: keep going" in green, then "Solved!"
      with a tinted frame, Next puzzle (primary) and Analyze. No alert pops up.
- [ ] **Hint / Show the move**: highlight the piece / the move; both disappear once solved.
- [ ] **Lichess puzzle**: after solving or missing it, the frame shows your rating and its
      change (from the second puzzle on); Next puzzle picks another one.
- [ ] **Analyze from a solved puzzle**: opens it in the analysis workspace with its moves.
- [ ] **Mistakes** (from a reviewed game): Next / Skip stays within the mistakes folder.
- [ ] **Repertoire trainer**: "4 to review · 2 new" top right; a new move says "New move: play
      …" with a green arrow; a wrong move turns the frame red with a red arrow; Show the move;
      Skip line / Next line; "All caught up" with the next review date.
- [ ] **Guess the move**: the board is square and whole; add candidates, Reveal, the verdict
      (green or red) and the score under it; Next move; "Game finished" at the end.

## UX overhaul, step 7: Library and books (branch feature/ux-overhaul)

- [ ] **Drag and drop**: drag PGN and PDF files from the Finder onto the Library: a dashed
      frame appears; on drop they are copied into the open folder ("Added …"); a second drop
      of the same file adds "name (1)"; an image or a folder is skipped with a message.
- [ ] **Import…**: pick several PGN/PDF files at once; they appear in the folder.
- [ ] **New → New folder / New study**: created with the name selected for renaming; Enter
      keeps the new name; the sidebar's Files tree updates.
- [ ] **Delete…**: asks first; Cancel keeps the file; a deleted file leaves Today's Continue.
- [ ] **Show in Finder** (folder row, or ⋯ in the header) opens the folder.
- [ ] **Sorting**: Modified puts the newest first and is remembered after a restart.
- [ ] **Search**: finds files in any folder; Esc clears it; opening a result's folder clears it.
- [ ] **Books**: every PDF in the Library appears, the last read first, with its page; a card
      opens the reader at that page; "n scanned diagrams" opens their folder.
- [ ] **Books → Add PDF…**: the book lands in Library / Books (created if missing).
- [ ] **Sidebar**: Books is highlighted while reading a PDF or scanning a whole book.
- [ ] **Databases**: after importing one, the search form appears; Delete… asks first.

## Reasons in chess terms, P2.8 R4 (branch feature/reasons)

- [ ] **Engine section, good moves**: play 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5: after a moment
      it says "It threatens Nxf7, a fork of the queen on d8 and the rook on h8". 1.e4 e5 2.Qh5
      Nc6 3.Bc4 g6: "It stops Qxf7#".
- [ ] **Engine section, bad moves**: the answer is named ("White answers Nxf7, a fork …").
- [ ] **Your own games**: do the reasons read right? Note any that are wrong or odd, with the
      position (that is what tunes the detectors).
- [ ] **Game review**: open a key moment; within a couple of seconds its explanation names
      the answer and the better move.
- [ ] **No slowdown**: the main analysis keeps running while the explainer searches (it is a
      second engine process, one thread).
- [ ] **Positional reasons (R3)**: quiet moves get a reason: "It develops the knight",
      "It castles: …", "puts the rook on the open d-file", "creates a passed pawn", "puts the
      knight on an outpost on d5"; a quiet bad move says what it costs ("weakens the pawns in
      front of the king"). Note any that feel wrong.
- [ ] **Hover in explanations**: moves and squares in the Engine section's and the review's
      explanations are bold; hovering a square circles it on the board, hovering a move draws
      its arrow (moves later in a line draw on the current board, where their pieces are not
      yet). The PGN editor's comments still highlight squares as before, and comment arrows to
      or from a1 now show (a1 was dropped).

## Explanations with their evidence, P2.4c (branch feature/explanation-contract)

Checked in the dev app: 1.e4 d5 2.Qg4?? explains the hanging queen, Bxg4 and the material,
and Evidence shows the scores for White (+0.75 / −7.96, depth 24), the board fact and the lines.

- [ ] **Evidence**: on a few of your own moves, open "Evidence" under the explanation: do the
      board facts, line claims and "Interpretation:" items match the sentences above?
- [ ] **Shallow**: right after a move, while the engine is still at low depth, the explanation
      says it has not searched deep enough yet, then judges once it has.
- [ ] **Repetition**: in a game where a position repeats a third time, the move that repeats
      it says a draw can be claimed.
- [ ] **No false forks**: a move that attacks two pieces where the engine does not win one is
      described as attacking both, not as a fork.

## Explanations worded by a model, P2.4b (branch feature/model-explanations)

Checked in the dev app with Ollama's qwen2.5:7b (local, no key): Settings → Explanations, Try
it, and "Say it as a coach" under 15.Nd5's explanation. The test setup was removed afterwards.

- [ ] **Anthropic**: Settings → Explanations → Anthropic, paste your API key, Save, Try it.
      Then under an explanation, "Say it as a coach": a short italic paragraph that keeps the
      moves (bold, highlighting on hover). Try claude-haiku-5-5 too (far cheaper): good enough?
- [ ] **The key stays put**: after saving, the key field says it is saved and is empty; Forget
      removes it (the button disappears from explanations).
- [ ] **Errors**: a wrong key says "The API key was not accepted"; Ollama stopped says it could
      not reach the provider.
- [ ] **A built app** (CSP): the requests go through Rust, so nothing should change, but check
      once in `pnpm build:mac`.

## Pins and Stockfish's piece values in explanations (branch feature/reasons-pins-values)

Checked in the dev app: 15.Nd5 in the Capablanca game (TestData/01.pgn) says "It also
improves the knight: Stockfish's piece values put it 2.1 higher on d5 than on e3".

- [ ] **Pins named**: in a game with a pin that wins material (a bishop pinning a knight to
      the king, then taking it), the Engine section or a review's key moment names "a pin of
      the knight on … to the king". Does it read right, and is it a real pin?
- [ ] **Piece values while you analyse**: step through a game of yours with the engine on;
      the "improves the …" sentences appear now and then (not on every move), never on
      captures, and agree with your sense of the piece.
- [ ] **Another analysis engine** (if you have one, e.g. Lc0 for analysis in Settings):
      no piece-value sentences, and no delay or error.

## Tutor level from the puzzle rating (branch feature/tutor-start-level)

- [ ] **Start level**: with the Lichess puzzles imported, solve or fail 20 of them, then open
      Play with the tutor on and "Your level: Automatic": the level shows your puzzle rating
      less about 300 (e.g. 1500 → "Automatic (1200)", 1760 → 1500).
- [ ] **Games take over**: finish a tutor game; more puzzles afterwards no longer change the
      level, only games do.
- [ ] **A chosen level stays**: pick a fixed level (not Automatic); puzzles don't change it.

## GameManager split (branch feature/split-gamemanager)

Checked in the dev app: analysis moves and engine arrows, a puzzle (right move, the reply,
a wrong move with the refutation arrow, Try again), Play with the tutor as Black, promotion.

- [ ] **PDF reader notes** (the compact board): moves and arrows work, and the arrow keys
      move through the notes only after a click inside them.
- [ ] **A clocked game** (tutor off, a time control): both clocks run and a flag ends the game.

## useChessEngine as a state machine (branch feature/engine-state-machine)

Checked in the dev app: analysis lines and hint arrow, threat mode, a game review, a game
against Maia (its moves, the "Suggest Move" hint on your turn).

- [ ] **Resign while the engine thinks** (a slow engine, long movetime): no engine move
      appears after the game ends.
- [ ] **An opening book** for the engine (Settings → Engines): it plays book moves, then
      searches once out of the book.
- [ ] **Analysis settings**: changing the number of lines while analysing restarts the
      analysis with the new number.

## App auto-update, X.1 (branch feature/auto-update)

Needs the one-time setup in the README (Releases and updates): the key, the secrets, a public
repository.

- [ ] **First release**: tag `v0.1.0`, push it; the Release workflow's three jobs pass and a
      draft release holds the .dmg, .app.tar.gz (+ .sig) for both Macs, the Windows installers
      and latest.json. Publish it.
- [ ] **macOS install**: the .dmg opens without "unidentified developer" (notarized).
- [ ] **An update**: with 0.1.0 installed, release 0.1.1 the same way. After a restart, about
      20 s in, "ReChess 0.1.1 is available"; Settings → Updates shows it with its notes;
      "Install and restart" downloads (bar), restarts, and Updates shows 0.1.1. Library,
      settings and puzzles are untouched.
- [ ] **Windows**: the same update from 0.1.0 to 0.1.1 on Windows.
- [ ] **Check now** with no newer release: "ReChess is up to date". Switching off "Check for a
      new version when ReChess starts": no toast on the next start.

## Auto sync and review, P1.4 (branch feature/auto-sync)

- [ ] **Add an account** (Settings → Accounts) and play a game online; restart ReChess after
      6 hours (or remove `lastSync` from the account in settings.json): about 15 s after
      start, "N new games from Lichess: reviewing them in the background", then "Reviewed N
      new games: M mistakes to look at on Today".
- [ ] **Today → New online games**: the games with your mistakes; a click opens that game in
      its month file (not the month's first game), with the ?/?? marks and the review graph.
- [ ] **Your notes survive**: a note added to an online game before a sync is still there.
- [ ] **Switch off** the "Sync on start" box: nothing happens on the next start.

## Tutor mode, P2.9 T1–T3 (branch feature/tutor)

- [ ] **Turn it on**: Play → tick Tutor, choose your level and what it asks about; the time
      control disappears (tutor games have no clock); start a game: the opponent is "Tutor".
- [ ] **Its strength**: does it feel like a fair fight at your level? When it is clearly
      winning, does it ease off? Too easy, too hard: note your level and the game.
- [ ] **"Are you sure?"**: play a clear mistake (e.g. a piece where a pawn takes it): it asks,
      with the reason; Take it back restores your turn; Keep my move lets the game go on.
- [ ] **Warnings**: leave something hanging for the tutor to attack: "Watch out: … threatens
      …" appears on your turn.
- [ ] **Chances**: when one move is much better than the rest, "There's something strong
      here"; Hint shows the piece, More the square.
- [ ] **Its mistakes**: now and then "I've just made a mistake. Can you find how to take
      advantage of it?" Is there really something to find?
- [ ] **Without the tutor**: Play works as before (clock, the chosen engine and level).
- [ ] **After the game (T4)**: resign or finish a game: the summary shows the result, your
      costliest moves ("it allowed a fork"), strong moves found or missed, and Train buttons
      that open a puzzle of that theme (needs the Lichess puzzles downloaded). A move you took
      back is not in it.
- [ ] **Automatic level**: "Your level: Automatic (1200)"; win a game: 1300 next time; lose
      one with several mistakes: 1100. Picking a number turns Automatic off.

## UX overhaul, step 8: settings and polish (branch feature/ux-overhaul)

- [ ] **Settings**: every section still works as before (engines add/edit/test, opening
      books, accounts sync, Lichess token, backups and restore, appearance).
- [ ] **Find a setting**: "token", "dark", "restore", "maia" open the right section.
- [ ] **⌘K → "Settings: Engines"** opens that section; Today's "Add a chess engine" too.
- [ ] **Keyboard in menus**: Tab to a ⋯ button, Enter opens it on the first item, arrows
      move, Esc closes and focus is back on the button.
- [ ] **Rename in the Library**: the field is clearly a field; Esc keeps the old name.
- [ ] **Sidebar**: no Files tree any more. Is anything harder to reach without it?

## PDF reader (P4.4)

- [ ] **Text below the diagram** (P4.4e, needs work): "Text below the diagram: …" shows the
      right moves for a few diagrams; "Add these moves" plays them into the notes.
- [ ] **Side to move from the caption**: on diagrams captioned "White/Black to play" the side
      is right; on others it follows the first move number in the text.
- [ ] **Piece icons in moves** (P4.4f, known weak): a line with figurines ("2 ♘f3") is read
      as piece moves, not "2 f3"; where it can't tell, it stops instead of guessing.
- [ ] **Selection box**: select moves on a page → "As moves: …" previews them from the move
      shown; "Add as moves" adds exactly those; "Add as a comment" adds the text with
      "(p. N)"; "Clear" empties it.
- [ ] **Notes save**: moves/comments made in the notes are still there after closing and
      reopening the book; a diagram you only looked at gets no file (no corner mark).
- [ ] **Notes board after the first save**: both sides' moves can be made on the notes board
      after the first one is saved (the board-bounds fix).
- [ ] **Keys in the notes**: arrows scroll the book until you click inside the notes; then
      ← → move through the notes.

## Analysis and editor

- [ ] **Keyboard shortcuts** (O.2): ← → ↑ ↓ Home End, Shift+↑/↓ between variations, F flips
      (and the flip is kept in the PGN), L engine on/off, X threat, Space plays the engine's
      best move, ? opens the list. Typing in a comment or the PGN text is not hijacked.
- [ ] **Shortcuts in play and puzzles**: moving through the game is off while playing the
      engine and in puzzles; F only turns the view there.
- [ ] **Copy board image** (O.5, built app): pastes into another app with the current board
      and piece theme and the last move highlighted.
- [ ] **Save PNG / Save GIF** (O.5, built app): the save dialog opens with the game's name;
      the GIF plays the line shown from the start, one move a second.

## YouTube videos (I.1)

- [ ] **Attach** (built app): the YouTube button in the editor toolbar, paste a link, type
      2:03, "Add to the move": the move's comment shows a "▶ 2:03" chip and the PGN has
      `https://youtu.be/…?t=123`.
- [ ] **Play embedded** (built app, the important one): clicking the chip opens the player at
      2:03. If YouTube shows "Error 153" or "Video unavailable" instead, tell me: embeds may
      need a different approach under macOS's `tauri://` origin.
- [ ] **Open in browser**: the player's button opens the video at the same time.
- [ ] **Links in imported PGNs**: a comment with a `youtube.com/watch?v=…&t=…` link shows a
      chip too; editing that comment keeps the link.
- [ ] **Keeps playing**: the video goes on while you step through the moves.

## Playing the engine

- [ ] **Clocks** (O.4): pick 3+2 on the Play page, start a game: both clocks show, the
      running one is highlighted, the increment is added after each move, red under 10 s.
- [ ] **Engine on the clock**: the engine spends sensible time per move (not its old fixed
      move time) and doesn't lose on time in a normal game.
- [ ] **Flag fall**: let your clock run out (1+0): the game ends, "You ran out of time".
- [ ] **Clocks in History**: the saved game has `[TimeControl]` and `[%clk]` on every move.

## Backups (O.6)

- [ ] **Back up now**: a zip is saved where you choose; it opens and has Library, settings,
      data.sqlite.
- [ ] **Restore**: change a puzzle priority, restore the backup, the old priority is back;
      a `before-restore-….zip` is in the Backups folder; settings came back too.
- [ ] **Automatic backup**: about 30 s after start an `auto-….zip` appears in Backups (only
      once a day; turning the option off stops it).

## CI (O.7)

- [ ] **First CI run on Windows**: the new `rust` job passes on `windows-latest` (a warning
      that only shows on Windows fails it).
