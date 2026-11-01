// A minimal UCI client for the measurements (Node only, never in the app: the app talks to
// engines through Rust, src-tauri/src/engine.rs). STOCKFISH=path/to/stockfish.

import { ChildProcessWithoutNullStreams, spawn } from "child_process";

export class Uci {
    private proc: ChildProcessWithoutNullStreams;
    private buffer = "";
    private waiting?: {
        until: RegExp;
        lines: string[];
        done: (l: string[]) => void;
    };

    constructor(path: string) {
        this.proc = spawn(path);
        this.proc.stdout.on("data", (chunk: Buffer) => {
            this.buffer += chunk.toString();
            let nl: number;
            while ((nl = this.buffer.indexOf("\n")) >= 0) {
                const line = this.buffer.slice(0, nl).trim();
                this.buffer = this.buffer.slice(nl + 1);
                const w = this.waiting;
                if (!w) continue;
                w.lines.push(line);
                if (w.until.test(line)) {
                    this.waiting = undefined;
                    w.done(w.lines);
                }
            }
        });
    }

    private send(cmd: string, until?: RegExp): Promise<string[]> {
        return new Promise((done) => {
            if (until) this.waiting = { until, lines: [], done };
            this.proc.stdin.write(cmd + "\n");
            if (!until) done([]);
        });
    }

    async init() {
        await this.send("uci", /^uciok/);
        await this.send("isready", /^readyok/);
    }

    /** The principal variation at `depth` from `fen`. */
    async pv(fen: string, depth: number): Promise<string[]> {
        await this.send(`position fen ${fen}`);
        const lines = await this.send(`go depth ${depth}`, /^bestmove/);
        const last = lines
            .filter((l) => l.startsWith("info") && l.includes(" pv "))
            .at(-1);
        return last ? last.split(" pv ")[1].trim().split(/\s+/) : [];
    }

    /**
     * The score of `fen` for the side to move at `depth`, in centipawns (mate as ±100000 less
     * the distance), searching only `moves` when given.
     */
    async score(
        fen: string,
        depth: number,
        moves?: string[],
    ): Promise<number | undefined> {
        await this.send(`position fen ${fen}`);
        const only = moves?.length ? ` searchmoves ${moves.join(" ")}` : "";
        const lines = await this.send(`go depth ${depth}${only}`, /^bestmove/);
        const last = lines
            .filter((l) => l.startsWith("info") && / score /.test(l))
            .at(-1);
        const m = last?.match(/ score (cp|mate) (-?\d+)/);
        if (!m) return undefined;
        const n = Number(m[2]);
        return m[1] === "cp" ? n : Math.sign(n) * (100000 - Math.abs(n));
    }

    /**
     * The engine's `count` best lines in `fen` at `depth`, scored from White's side as the
     * app's searchOnce gives them.
     */
    async lines(fen: string, depth: number, count: number) {
        await this.send(`setoption name MultiPV value ${count}`);
        await this.send(`position fen ${fen}`);
        const out = await this.send(`go depth ${depth}`, /^bestmove/);
        await this.send("setoption name MultiPV value 1");
        const black = fen.split(" ")[1] === "b";
        const lines: {
            pv: string[];
            score: { type: "cp" | "mate"; value: number };
            depth: number;
        }[] = [];
        for (const l of out) {
            const m = l.match(
                / depth (\d+) .*multipv (\d+) score (cp|mate) (-?\d+).* pv (.+)$/,
            );
            if (!m) continue;
            const value = Number(m[4]) * (black ? -1 : 1);
            lines[Number(m[2]) - 1] = {
                pv: m[5].trim().split(/\s+/),
                score: { type: m[3] as "cp" | "mate", value },
                depth: Number(m[1]),
            };
        }
        return lines.filter(Boolean);
    }

    /** Stockfish's `eval` output for `fen` (its NNUE piece values table among it). */
    async evalLines(fen: string): Promise<string[]> {
        await this.send(`position fen ${fen}`);
        return this.send("eval", /^Final evaluation/);
    }

    quit() {
        this.proc.stdin.write("quit\n");
    }
}
