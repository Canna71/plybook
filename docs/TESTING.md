# Things to test by hand

Features that pass the automated checks (typecheck, lint, Vitest, cargo tests, build) but have
not been tried in the running app yet. Test in a **built** app where noted (`pnpm build:mac`):
the CSP and signing only apply there. Tick an item when it's confirmed, note what went wrong
when it isn't, and remove ticked items once their roadmap entry says "confirmed by the owner".

Everything listed before 2026-11-01 was confirmed by the owner that day, except what needs a
release or Windows, below.

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
