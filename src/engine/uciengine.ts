import {
    AnalysisOptions,
    EngineId,
    EngineInfo,
    EngineOption,
    EngineOptions,
    IChessEngine,
    IEngineEventEmitter,
} from "./engineinterfaces";
import { IUCIInterface } from "./iuciinterface";
import anylogger from "anylogger";
const log = anylogger("uciengine");

// interface EngineOption {
//     name: string;
//     type: "check" | "spin" | "combo" | "string" | "button";
//     default: any;
//     min?: number;
//     max?: number;
//     var?: string;
//     options?: string[];
// }

// UCIEngine.ts
export class UCIEngine implements IChessEngine, IEngineEventEmitter {
    private uciInterface: IUCIInterface;
    private isReady = false;
    private callbacks: Map<string, Function[]> = new Map();

    private engineId?: EngineId;
    private EngineOptions?: EngineOptions;
    // private options: EngineOption[] = [];

    constructor(uciInterface: IUCIInterface) {
        this.uciInterface = uciInterface;
        this.uciInterface.onResponse((line) => this.processEngineOutput(line));
    }
    getElos?(): [{ level: number; elo: number }] {
        throw new Error("Method not implemented.");
    }
    getId(): EngineId | undefined {
        return this.engineId;
    }

    analyzeFromFenOrMoves(
        fenOrMoves: string[] | string,
        options: AnalysisOptions,
    ): void {
        this.uciInterface.sendCommand("stop");
        if (typeof fenOrMoves === "string") {
            this.uciInterface.sendCommand(`position fen ${fenOrMoves}`);
        } else {
            this.uciInterface.sendCommand(
                `position startpos moves ${fenOrMoves.join(" ")}`,
            );
        }
        // TODO: put in settings or somewhere else
        this.setOption("Threads", options.threads || 1);
        let goCommand = "go";
        const clock = options.clock;
        if (options.nodes) {
            goCommand += ` nodes ${options.nodes}`;
        } else if (clock) {
            goCommand += ` wtime ${clock.wtime} btime ${clock.btime} winc ${clock.winc} binc ${clock.binc}`;
        } else if (options.depth) goCommand += ` depth ${options.depth}`;
        if (!options.nodes && !clock && options.movetime)
            goCommand += ` movetime ${options.movetime}`;
        if (options.multipv) {
            this.setOption("MultiPV", options.multipv);
        }
        // last: searchmoves takes every move that follows it
        if (options.searchmoves?.length) {
            goCommand += ` searchmoves ${options.searchmoves.join(" ")}`;
        }
        // wait 10 ms
        setTimeout(() => {
            this.uciInterface.sendCommand(goCommand);
        }, 10);
    }
    stop(): void {
        this.uciInterface.sendCommand("stop");
    }
    quit(): void {
        this.uciInterface.sendCommand("quit");
    }
    newGame(): void {
        this.uciInterface.sendCommand("ucinewgame");
    }
    setOption(name: string, value: any): void {
        this.uciInterface.sendCommand(`setoption name ${name} value ${value}`);
    }

    getOptions(): EngineOptions | undefined {
        return this.EngineOptions;
    }

    on(event: string, callback: Function): void {
        if (!this.callbacks.has(event)) {
            this.callbacks.set(event, []);
        }
        this.callbacks.get(event)?.push(callback);
    }

    off(event: string, callback: Function): void {
        const index = this.callbacks.get(event)?.indexOf(callback);
        if (index !== undefined && index !== -1) {
            this.callbacks.get(event)?.splice(index, 1);
        }
    }

    private emit(event: string, ...args: any[]): void {
        this.callbacks.get(event)?.forEach((callback) => callback(...args));
    }

    async init(): Promise<void> {
        await this.uciInterface.init();
        this.uciInterface.sendCommand("uci");

        // Wait for engine to be ready
        return new Promise((resolve) => {
            const checkReady = () => {
                if (this.isReady) resolve();
                else setTimeout(checkReady, 100);
            };
            checkReady();
        });
    }

    // ... other IChessEngine implementation methods ...

    private processEngineOutput(line: string): void {
        log.debug(line);
        const tokens = line.trim().split(" ");

        switch (tokens[0]) {
            case "uciok":
                this.uciInterface.sendCommand("isready");
                break;
            case "readyok":
                this.isReady = true;
                this.emit("ready");
                break;
            case "bestmove": {
                const bestmove = tokens[1];
                const ponder = tokens[3]; // Optional ponder move
                this.emit("bestmove", bestmove, ponder);
                break;
            }

            case "info": {
                if (tokens[1] === "string") {
                    // free text: Lc0 move stats, engine messages
                    this.emit(
                        "string",
                        line.trim().slice("info string ".length),
                    );
                    break;
                }
                const info = this.parseInfoMessage(tokens.slice(1));
                if (info) {
                    this.emit("info", info);
                }
                break;
            }
            case "id":
                this.parseId(tokens);
                break;
            case "option":
                this.parseOptions(tokens);
                break;

            default:
                if (line.startsWith("error")) {
                    this.emit("error", new Error(line));
                }
        }
    }
    parseOptions(tokens: string[]) {
        // option name Skill Level type spin default 20 min 0 max 20

        const typeIndex = tokens.indexOf("type");

        // const optionsIndex = tokens.indexOf("options"); // Optional
        // name is at 2 until type

        const optionName = tokens.slice(2, typeIndex).join(" ");

        const optionType = tokens[typeIndex + 1];
        const optionDefault = tokens[typeIndex + 3];
        const optionMin = tokens[typeIndex + 5];
        const optionMax = tokens[typeIndex + 7];
        const optionVar = tokens.slice(typeIndex + 9);
        // const optionOptions = tokens.slice(7);
        const option: EngineOption = {
            name: optionName,
            type: optionType as
                | "check"
                | "spin"
                | "combo"
                | "string"
                | "button",
            default: optionDefault,
            min: optionMin ? parseInt(optionMin, 10) : undefined,
            max: optionMax ? parseInt(optionMax, 10) : undefined,
            var: optionVar,
            // options: optionOptions,
        };

        this.EngineOptions = {
            ...(this.EngineOptions || {}),
            [optionName]: option, // Use optionName as the key
        };
    }

    private parseId(tokens: string[]): void {
        if (tokens[1] === "name") {
            this.engineId = {
                ...(this.engineId || {}),
                name: tokens.slice(2).join(" "),
            };
        } else if (tokens[1] === "author") {
            this.engineId = {
                ...(this.engineId || {}),
                author: tokens.slice(2).join(" "),
            };
        }
    }

    /**
     * Parse info string from engine
     */
    /**
     * Parses a UCI engine info message into a structured format
     * @param infoMessage - The raw info message from the engine
     * @returns Parsed engine information or null if parsing fails
     */
    private parseInfoMessage(tokens: string[]): EngineInfo | null {
        try {
            const result: EngineInfo = {};

            // Skip 'info' at parts[0]
            for (let i = 0; i < tokens.length; i++) {
                switch (tokens[i]) {
                    case "multipv":
                        if (i + 1 < tokens.length) {
                            result.multipv = parseInt(tokens[++i], 10);
                        }
                        break;

                    case "depth":
                        if (i + 1 < tokens.length) {
                            result.depth = parseInt(tokens[++i], 10);
                        }
                        break;

                    case "score":
                        if (i + 2 < tokens.length) {
                            const scoreType = tokens[++i] as "cp" | "mate";
                            const scoreValue = parseInt(tokens[++i], 10);
                            result.score = {
                                type: scoreType,
                                value: scoreValue,
                            };
                        }
                        break;

                    case "pv": {
                        // Collect all remaining tokens as moves
                        const moves: string[] = [];
                        while (
                            ++i < tokens.length &&
                            !tokens[i].includes("bmc")
                        ) {
                            // Stop at known keywords or end of string
                            if (
                                [
                                    "depth",
                                    "multipv",
                                    "score",
                                    "nodes",
                                    "nps",
                                    "time",
                                ].includes(tokens[i])
                            ) {
                                i--; // Back up one to allow the next iteration to handle this token
                                break;
                            }
                            moves.push(tokens[i]);
                        }
                        result.pv = moves;
                        break;
                    }

                    case "nodes":
                        if (i + 1 < tokens.length) {
                            result.nodes = parseInt(tokens[++i], 10);
                        }
                        break;

                    case "nps":
                        if (i + 1 < tokens.length) {
                            result.nps = parseInt(tokens[++i], 10);
                        }
                        break;

                    case "time":
                        if (i + 1 < tokens.length) {
                            result.time = parseInt(tokens[++i], 10);
                        }
                        break;

                    case "currmove":
                        if (i + 1 < tokens.length) {
                            result.currmove = tokens[++i];
                        }
                        break;

                    case "currmovenumber":
                        if (i + 1 < tokens.length) {
                            result.currmovenumber = parseInt(tokens[++i], 10);
                        }
                        break;

                    case "hashfull":
                        if (i + 1 < tokens.length) {
                            result.hashfull = parseInt(tokens[++i], 10);
                        }
                        break;

                    case "tbhits":
                        if (i + 1 < tokens.length) {
                            result.tbhits = parseInt(tokens[++i], 10);
                        }
                        break;

                    case "seldepth":
                        if (i + 1 < tokens.length) {
                            result.seldepth = parseInt(tokens[++i], 10);
                        }
                        break;
                }
            }

            return result;
        } catch (error) {
            log.error("Error parsing info message:", error);
            return null;
        }
    }
}
