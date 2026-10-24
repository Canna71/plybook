---
description: Run every local check (typecheck, lint, build, and Rust checks when src-tauri changed)
allowed-tools: Bash(pnpm typecheck:*), Bash(pnpm lint:*), Bash(pnpm build:*), Bash(cargo check:*), Bash(cargo clippy:*), Bash(cargo fmt:*), Bash(git diff:*), Bash(git status:*), Bash(git fetch:*)
---

Run the ReChess checks and report the results.

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm build`
4. If `git diff --name-only origin/develop...HEAD` or `git status --porcelain` lists anything under
   `src-tauri/`, also run in `src-tauri/`: `cargo check`, `cargo clippy`, `cargo fmt --check`.
   CI does not cover Rust, so this step matters.

Summarize each step as pass or fail. For failures, show the relevant error lines and propose a fix,
but do not edit files unless I ask. $ARGUMENTS
