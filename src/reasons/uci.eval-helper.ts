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

    /** Stockfish's `eval` output for `fen` (its NNUE piece values table among it). */
    async evalLines(fen: string): Promise<string[]> {
        await this.send(`position fen ${fen}`);
        return this.send("eval", /^Final evaluation/);
    }

    quit() {
        this.proc.stdin.write("quit\n");
    }
}
