---
description: Verify the branch and open a pull request against develop
allowed-tools: Bash(pnpm typecheck:*), Bash(pnpm lint:*), Bash(pnpm build:*), Bash(cargo check:*), Bash(cargo clippy:*), Bash(git:*), Bash(gh pr create:*), Bash(gh pr view:*)
---

Prepare and open a PR for the current branch.

1. Refuse if the current branch is `develop` or `main`; ask for a feature branch instead.
2. Run the checks from `/check` (including Rust checks if `src-tauri/` changed). If anything fails,
   stop and report.
3. Use the `reviewer` agent on `git diff origin/develop...HEAD` and fix any real bugs it finds
   (ask me first if a fix is large).
4. Make sure everything is committed with a Conventional Commit style message, then
   `git push -u origin HEAD`.
5. Open the PR with **base `develop`** (`gh pr create --base develop`), with a body covering what
   changed, why, how it was verified (which checks ran, whether the app was run on macOS/Windows),
   and anything left for a manual check.

Extra notes from me: $ARGUMENTS
