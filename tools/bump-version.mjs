// Sets the app's version everywhere it is written (F.12): package.json (which tauri.conf.json
// reads), src-tauri/Cargo.toml and the app's entry in Cargo.lock. It does not commit or tag;
// it prints the commands for a release (docs/DEVELOPMENT.md).
//
//   pnpm bump patch | minor | major | 1.2.3

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const file = (path) => join(root, path);

const pkg = JSON.parse(readFileSync(file("package.json"), "utf8"));
const current = pkg.version;
const arg = process.argv[2];

function next(version, how) {
    if (/^\d+\.\d+\.\d+$/.test(how)) return how;
    const [major, minor, patch] = version.split(".").map(Number);
    if (how === "major") return `${major + 1}.0.0`;
    if (how === "minor") return `${major}.${minor + 1}.0`;
    if (how === "patch") return `${major}.${minor}.${patch + 1}`;
    return undefined;
}

const version = arg && next(current, arg);
if (!version) {
    console.error(
        `Version ${current}. Usage: pnpm bump patch | minor | major | X.Y.Z`,
    );
    process.exit(1);
}

/** Replaces one match in a file, or stops: a file that no longer looks as expected */
function replaceIn(path, pattern, replacement) {
    const text = readFileSync(file(path), "utf8");
    if (!pattern.test(text)) {
        console.error(`No version found in ${path}; nothing changed there.`);
        process.exit(1);
    }
    writeFileSync(file(path), text.replace(pattern, replacement));
}

// textual edits keep each file's formatting
replaceIn("package.json", /("version":\s*")[^"]+(")/, `$1${version}$2`);
replaceIn(
    "src-tauri/Cargo.toml",
    /(\[package\][^[]*?\nversion\s*=\s*")[^"]+(")/,
    `$1${version}$2`,
);
replaceIn(
    "src-tauri/Cargo.lock",
    /(\nname = "plybook"\nversion = ")[^"]+(")/,
    `$1${version}$2`,
);

console.log(`${current} → ${version}. To release it:
  git commit -am "chore: version ${version}"
  git tag v${version} && git push origin develop v${version}`);
