// The opening names bundled with the app (src/assets/openings, CC0), read on first use.

import a from "../assets/openings/a.tsv?raw";
import b from "../assets/openings/b.tsv?raw";
import c from "../assets/openings/c.tsv?raw";
import d from "../assets/openings/d.tsv?raw";
import e from "../assets/openings/e.tsv?raw";
import { Opening, openingOf, parseOpenings } from "./openings";

let named: Map<string, Opening> | undefined;

/** Every named position, parsed once (a few thousand lines) */
export const namedOpenings = () => (named ??= parseOpenings([a, b, c, d, e]));

/** The most specific named opening of a line of positions, oldest first */
export const openingOfLine = (fens: (string | undefined)[]) =>
    openingOf(fens, namedOpenings());
