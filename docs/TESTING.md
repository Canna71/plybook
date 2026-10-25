# Things to test by hand

Features that pass the automated checks (typecheck, lint, Vitest, cargo tests, build) but have
not been tried in the running app yet. Test in a **built** app where noted (`pnpm build:mac`):
the CSP and signing only apply there. Tick an item when it's confirmed, note what went wrong
when it isn't, and remove ticked items once their roadmap entry says "confirmed by the owner".

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
