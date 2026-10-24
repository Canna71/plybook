---
description: Start a new feature branch from the latest develop
argument-hint: <topic>
allowed-tools: Bash(git fetch:*), Bash(git checkout:*), Bash(git switch:*), Bash(git status:*)
---

Start work on `$ARGUMENTS`.

1. Check `git status`; if there are uncommitted changes, stop and ask me what to do with them.
2. `git fetch origin develop`
3. Create and switch to `feature/<topic>` from `origin/develop`, where `<topic>` is a short
   kebab-case name derived from: $ARGUMENTS
4. Read the parts of `CLAUDE.md` and the code relevant to the topic and propose a short plan before
   editing anything.
