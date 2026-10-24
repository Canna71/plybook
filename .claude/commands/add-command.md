---
description: Add a Tauri command end to end (Rust, registration, TS wrapper, capability check)
argument-hint: <command name and what it should do>
---

Add a new Tauri command: $ARGUMENTS

Use the `tauri-rust` agent's rules from `.claude/agents/tauri-rust.md`.

1. Pick the module (`db.rs` for database work, `engine.rs` for processes and OS integration, or a
   new module declared in `lib.rs`) and write the `#[tauri::command]` returning `Result<T, String>`.
2. Register it in `generate_handler![...]` in `src-tauri/src/lib.rs`.
3. Add a typed `invoke()` wrapper in `src/storage/db.ts` (or the matching frontend module), with TS
   types that mirror the serde shape.
4. Confirm no capability change is needed. If one is, keep it as narrow as possible and explain why.
5. Run `cargo check` in `src-tauri/` and `pnpm typecheck && pnpm lint`, and report the results.
