// Makes a piece set's stylesheet for chessground from a folder of 12 images named as Lichess
// names them (wK.svg, bQ.png…), each embedded as a data URI, as the sets in
// src/assets/styles/pieces are. Usage: node tools/piece-css.mjs <folder> <out/pieces.css>

import { readFileSync, readdirSync, writeFileSync } from "fs";
import { extname, join } from "path";

const ROLES = { P: "pawn", N: "knight", B: "bishop", R: "rook", Q: "queen", K: "king" };
const COLORS = { w: "white", b: "black" };
const TYPES = { ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp" };

const [folder, out] = process.argv.slice(2);
if (!folder || !out) {
    console.error("usage: node tools/piece-css.mjs <folder> <out/pieces.css>");
    process.exit(1);
}
const files = readdirSync(folder);
const rules = [];
for (const [c, color] of Object.entries(COLORS)) {
    for (const [r, role] of Object.entries(ROLES)) {
        const file = files.find(
            (f) => f.slice(0, 2) === c + r && TYPES[extname(f).toLowerCase()],
        );
        if (!file) {
            console.error(`${folder}: no image for ${c}${r}`);
            process.exit(1);
        }
        const data = readFileSync(join(folder, file)).toString("base64");
        const type = TYPES[extname(file).toLowerCase()];
        rules.push(
            `.cg-wrap piece.${role}.${color} {\n    background-image: url('data:${type};base64,${data}');\n}`,
        );
    }
}
writeFileSync(out, `/** Embedded images for all chess pieces */\n${rules.join("\n")}\n`);
console.log(`${out}: 12 pieces`);
