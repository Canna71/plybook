# Things to test by hand

Features that pass the automated checks (typecheck, lint, Vitest, cargo tests, build) but have
not been tried in the running app yet. Test in a **built** app where noted (`pnpm build:mac`):
the CSP and signing only apply there. Tick an item when it's confirmed, note what went wrong
when it isn't, and remove ticked items once their roadmap entry says "confirmed by the owner".

Everything listed before 2026-11-01 was confirmed by the owner that day, except what needs a
release or Windows, below.

## Owner feedback, round 3: bugs (branch feature/feedback-round-3)

- [ ] **Moves in explanations, F.31**: in a review's key moment like "Bb5 is a blunder … Only
      e5 … Better was e5", hovering either e5 draws the same side's arrow (the side that
      played Bb5).
- [ ] **Promotion, F.32**: promote in a puzzle where you play Black (board flipped), and in
      Play: the four pieces stand over the promotion square, queen next to it; a click
      promotes. (Seen in Analysis, flipped and not.)
- [ ] **Review after a game, F.33**: finish a game against the engine, open Game review:
      clicking a move in the moves list, a key moment or the graph goes to it. During a game,
      clicks in the moves list still do nothing.
- [ ] **Tablebase, F.39**: in Analysis, paste an endgame, then another: the tablebase line
      shows "Tablebase…" and then the new position's moves, never the old ones.
- [ ] **Reader's position editor, F.34**: pick a diagram, ⋯ → Change the starting position:
      the board and both trays show whole; only the notes panel scrolls; Accept and Cancel
      work. (Seen in the dev app.) Analysis → ⋯ → Change the starting position still fits
      the board column as before.

## Owner feedback, round 3: more (branch feature/feedback-round-3-more)

- [ ] **Side to move, F.42**: confirmed by the owner on Collins p. 13 (2026-11-01). Left: a
      book with "White to play" captions still reads them.
- [ ] **Editor trays, F.41**: in the dark theme, the board editor's (and the reader's
      Change the starting position) trays are light, and both colours' pieces are clear.
- [ ] **A screen that fails, F.40**: nothing to do unless one does: it should say "Something
      went wrong on this screen" with Try again, and the sidebar still works. Tell me what
      the message says.

## Pasted lesson hang, F.46 (branch feature/paste-hang)

- [ ] **The lesson opens**: paste the Tarrasch lesson's JSON again: it opens in Analysis
      facing Black, and 11.Qxc6+ shows its arrows to e8 and a8. (Seen in the dev app.)
- [ ] **Adding a comment still opens it for typing**: on a move, ⋯ → "Add a comment to
      this move", and right-click a move → add a comment after (and before): the new box has
      the caret, typing goes there, clicking away keeps the text. Also on a move that
      already has arrows only (11.Qxc6+ in the lesson). Couldn't be checked with the dev
      driver.
- [ ] **Arrow keys after opening it**: with the lesson open, ← and → step through the moves
      (no comment box holds the focus).

## Piece values with Stockfish 19, F.45 (branch feature/explain-activity)

- [ ] **They are back**: in Analysis with the engine on, step through a game of yours: now
      and then a move says "improves the knight: Stockfish's piece values put it … higher on
      …" (about one move in ten). The explanation still appears at once, the sentence a
      moment later. Note any that reads wrong (a retreat called an improvement).

## Keychain only when needed, F.44 (branch feature/keychain-on-demand)

- [ ] **One last time**: the first start of a build with this change asks once (it fills the
      new index with what is set). Allow it.
- [ ] **Then quiet**: restart, open Analysis, Settings → Accounts and → Explanations: no
      Keychain dialog; both still show the token and the model as set. Opening the Explorer
      (with the Lichess token) or "Say it as a coach" may ask once per run on an unsigned
      build, never on a signed one after "Always Allow".

## Explanations that explain, F.37 (branch feature/explain-settled)

- [ ] **Your 1-0 game in History**, Game review, key moments: 9.Re1 says Black can trade
      queens (Qxd4) while Black's king is in the centre and that e5 keeps them on; 12.e5 says
      "After Qxe3 Bxe3 dxe5: Black wins material (+1)" and "Better was Qh3: it stops Qxe3";
      none says "attacks the knight with a cheaper piece" for a pawn that is taken back at
      once. Do these read as reasons now? Note any that is wrong.
- [ ] **The coach, F.37d** (with a model set up, Settings → Explanations): "Say it as a
      coach" on those moments gives a paragraph under "The coach's reading" that explains
      (what the opponent gets, what the better move keeps), not the same sentences reworded.
      Try claude-haiku-5-5 and a bigger model. Note when it is refused ("added things of its
      own") and with what.
- [ ] **Nothing worse elsewhere**: a blunder that hangs a piece still says so with the
      material ("After Nxc5: White wins material (+3)").
- [ ] **More readings (branch feature/explain-castled)**: in your Lichess game of 2024-10-02,
      10…d5 says White can double Black's pawns on the b-file (Nxb6 cxb6). A better move
      sometimes gets "it threatens …" a second after the moment opens (the threat search).
      Seen in the dev app: 9.Re1 in the review reads as in the first item.

## Coach in the review, History, Contents (branch feature/coach-history-toc)

- [ ] **Coach in the review, F.36**: with an explanation model set up, open a key moment of a
      reviewed game: "Say it as a coach" under its explanation gives the reworded text; the
      Engine section's button still works.
- [ ] **Delete from History, F.35**: point at a game: a bin appears at the end of the row;
      click it: it asks, Cancel keeps the game, Delete removes it (and it stays gone after
      Refresh). Clicking the row elsewhere still opens the game.
- [ ] **Contents, F.38**: in Collins, Contents lists the sections and chapters (Italian Game
      on 13, Ruy Lopez on 35), the current one in colour; a click goes there. Bookmark a page,
      close and reopen the book: the bookmark is there; × removes it. In *My System*, Contents
      says it found none and bookmarks still work. (Seen in the dev app with Collins.)

## App auto-update, X.1 (branch feature/auto-update)

Needs the one-time setup in the README (Releases and updates): the key, the secrets, a public
repository.

- [ ] **First release**: tag `v0.1.0`, push it; the Release workflow's three jobs pass and a
      draft release holds the .dmg, .app.tar.gz (+ .sig) for both Macs, the Windows installers
      and latest.json. Publish it.
- [ ] **macOS install**: the .dmg opens without "unidentified developer" (notarized).
- [ ] **An update**: with 0.1.0 installed, release 0.1.1 the same way. After a restart, about
      20 s in, "Plybook 0.1.1 is available"; Settings → Updates shows it with its notes;
      "Install and restart" downloads (bar), restarts, and Updates shows 0.1.1. Library,
      settings and puzzles are untouched.
- [ ] **Windows**: the same update from 0.1.0 to 0.1.1 on Windows.
- [ ] **Check now** with no newer release: "Plybook is up to date". Switching off "Check for a
      new version when Plybook starts": no toast on the next start.

## Windows

- [ ] **Icon, F.7**: the taskbar and Start menu icon.
- [ ] **First CI run on Windows, O.7**: the `rust` job passes on `windows-latest` (a warning
      that only shows on Windows fails it).
