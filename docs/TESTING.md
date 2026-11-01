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
