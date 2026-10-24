// Copies the files pdf.js loads by name at runtime (image decoders and standard fonts) from
// node_modules into public/pdfjs, which Vite serves in dev and copies into the build.
// Run by `pnpm dev` and `pnpm build`; public/pdfjs is git-ignored.

import { cpSync, mkdirSync, readdirSync, rmSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "node_modules", "pdfjs-dist");
const target = join(root, "public", "pdfjs");

rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(join(source, "standard_fonts"), join(target, "standard_fonts"), {
    recursive: true,
});
mkdirSync(join(target, "wasm"));
for (const file of readdirSync(join(source, "wasm"))) {
    // quickjs runs PDF scripts, which ReChess does not enable
    if (file.startsWith("quickjs")) continue;
    cpSync(join(source, "wasm", file), join(target, "wasm", file));
}
