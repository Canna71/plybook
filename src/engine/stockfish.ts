import { path } from '@tauri-apps/api';
import { join } from '@tauri-apps/api/path';

import { Child, Command } from '@tauri-apps/plugin-shell';
import { getEngineFolder } from '../storage/fs';

// Type definitions for Stockfish events
// @ts-ignore
type StockfishEvents = {
    'ready': () => void;
    'bestmove': (move: string, ponder?: string) => void;
    'info': (info: EngineInfo) => void;
    'error': (error: Error) => void;
};

// Type for parsed engine info
export interface EngineInfo {
    depth?: number;
    seldepth?: number;
    multipv?: number;
    score?: {
        value: number;
        type: 'cp' | 'mate';
    };
    nodes?: number;
    nps?: number;
    time?: number;
    pv?: string[];
    string?: string;
}

export class StockfishManager {
    private isReady = false;
    private exited = false;
    private callback: (event: string, ...args: any[]) => void;

    private command?: Command<string>;
    private child?: Child;

    private static theEngine?: StockfishManager;

    private constructor(callback: (event: string, ...args: any[]) => void) {
        this.callback = callback;

    }

    public static GetEngine(callback: (event: string, ...args: any[]) => void): StockfishManager {
        if (!StockfishManager.theEngine) {
            StockfishManager.theEngine = new StockfishManager(callback);
        } else {
            StockfishManager.theEngine.setCallback(callback);
        }
        return StockfishManager.theEngine;
    }


    /**
     * Emit an event by calling the callback function
     */
    private emit(event: string, ...args: any[]): void {
        this.callback(event, ...args);
    }

    // allow changing the callback function
    setCallback(callback: (event: string, ...args: any[]) => void) {
        this.callback = callback;
    }

    /**
     * Initialize the engine and wait for it to be ready
     */
    async init(): Promise<void> {

        if (this.isReady) return;

        // this.command = await Command.sidecar('./binaries/stockfish', [

        // ]);


        // this.command = await Command.create('stockfish', []);
        console.log("creating command");

        const enginePath = await getEngineFolder("stockfish-aarch64-apple-darwin");
        console.log("engine path", enginePath);

        // this.command = await Command.create('exec-sh', ["-c", "/Users/gcannata/Library/Application\\ Support/rechess/Binaries/stockfish-aarch64-apple-darwin"]);
        this.command = await Command.create('exec-sh', ["-c", `"${enginePath}"`]);

        console.log("command", this.command);

        this.command.stderr.on('data', (line: string) => this.processError(line));
        this.command.stdout.on('data', (line: string) => this.processEngineOutput(line));

        this.command.on('close', (code) => {
            console.log(`child process exited with code `, code);
            this.isReady = false;
            this.exited = true;
        });

        this.command.on('error', (err) => {
            console.error(`error: ${err}`);
        });

        console.log("spawning child");

        this.child = await this.command.spawn();


        console.log("child", this.child);

        this.sendCommand('uci');

        // Wait for the engine to be ready
        while (!this.isReady && !this.exited) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }


    }

    processError(data: string) {
        console.error(`stderr: ${data}`);
    }

    /**
     * Set engine options
     */
    setOption(name: string, value: string | number | boolean): void {
        this.sendCommand(`setoption name ${name} value ${value}`);
    }

    /**
     * Start analyzing from a given position
     */
    analyzePosition(fen: string, options: {
        depth?: number;
        movetime?: number;
        multipv?: number;
    } = {}): void {
        this.sendCommand('stop'); // Stop any ongoing analysis
        this.sendCommand('position fen ' + fen);

        let goCommand = 'go';
        if (options.depth) goCommand += ` depth ${options.depth}`;
        if (options.movetime) goCommand += ` movetime ${options.movetime}`;
        if (options.multipv) {
            this.setOption('MultiPV', options.multipv);
        }

        this.sendCommand(goCommand);
    }

    /**
     * Start analyzing from the starting position with moves
     */
    analyzeFromMoves(moves: string[] | string, options: {
        depth?: number;
        movetime?: number;
        multipv?: number;
    } = {}): void {



        this.sendCommand('stop');
        if (typeof moves === 'string') {
            this.sendCommand(`position fen ${moves}`);
        } else {
            this.sendCommand(`position startpos moves ${moves.join(' ')}`);
        }

        let goCommand = 'go';
        if (options.depth) goCommand += ` depth ${options.depth}`;
        if (options.movetime) goCommand += ` movetime ${options.movetime}`;
        if (options.multipv) {
            this.setOption('MultiPV', options.multipv);
        }

        // wait 10 ms
        setTimeout(() => {
            this.sendCommand(goCommand);
        }, 10);
        // this.sendCommand(goCommand);
    }

    /**
     * Stop the current analysis
     */
    stop(): void {
        this.sendCommand('stop');
    }

    /**
     * Quit the engine
     */
    quit(): void {
        this.sendCommand('quit');
    }

    newGame(): void {
        this.sendCommand('ucinewgame');
    }

    /**
     * Send a raw command to the engine
     */
    private sendCommand(command: string): void {
        console.log("sending command", command);
        this.child?.write(command + '\n');
    }

    /**
     * Process engine output
     */
    private processEngineOutput(line: string): void {
        // console.log("line", line);
        const tokens = line.trim().split(' ');

        switch (tokens[0]) {
            case 'uciok':
                this.sendCommand('isready');
                break;

            case 'readyok':
                this.isReady = true;
                this.emit('ready');
                break;

            case 'bestmove':
                const bestmove = tokens[1];
                const ponder = tokens[3]; // Optional ponder move
                this.emit('bestmove', bestmove, ponder);
                break;

            case 'info':
                const info = this.parseInfo(tokens.slice(1));
                if (Object.keys(info).length > 0) {
                    this.emit('info', info);
                }
                break;

            default:
                if (line.startsWith('error')) {
                    this.emit('error', new Error(line));
                }
        }
    }

    /**
     * Parse info string from engine
     */
    private parseInfo(tokens: string[]): EngineInfo {
        const info: EngineInfo = {};

        for (let i = 0; i < tokens.length; i++) {
            switch (tokens[i]) {
                case 'depth':
                    info.depth = parseInt(tokens[++i]);
                    break;

                case 'seldepth':
                    info.seldepth = parseInt(tokens[++i]);
                    break;

                case 'multipv':
                    info.multipv = parseInt(tokens[++i]);
                    break;

                case 'score':
                    info.score = {
                        type: tokens[++i] as 'cp' | 'mate',
                        value: parseInt(tokens[++i])
                    };
                    break;

                case 'nodes':
                    info.nodes = parseInt(tokens[++i]);
                    break;

                case 'nps':
                    info.nps = parseInt(tokens[++i]);
                    break;

                case 'time':
                    info.time = parseInt(tokens[++i]);
                    break;

                case 'pv':
                    info.pv = [];
                    while (++i < tokens.length && !tokens[i].includes('score')) {
                        info.pv.push(tokens[i]);
                    }
                    i--; // Adjust for the next iteration
                    break;

                case 'string':
                    info.string = tokens.slice(i + 1).join(' ');
                    i = tokens.length; // End parsing
                    break;
            }
        }

        return info;
    }
}

// // Usage example:
// const stockfish = new StockfishManager((event, ...args) => {
//     console.log(`Event: ${event}`, ...args);
// }

// // Initialize the engine
// await stockfish.init();

// // Listen for analysis results
// stockfish.on('info', (info) => {
//     if (info.score) {
//         console.log(`Evaluation: ${info.score.value} ${info.score.type}`);
//     }
//     if (info.pv) {
//         console.log(`Best line: ${info.pv.join(' ')}`);
//     }
// });

// stockfish.on('bestmove', (bestmove, ponder) => {
//     console.log(`Best move: ${bestmove}${ponder ? `, ponder: ${ponder}` : ''}`);
// });

// // Start analysis
// stockfish.analyzePosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', {
//     depth: 20,
//     multipv: 3
// });

// // Stop analysis after 5 seconds
// setTimeout(() => {
//     stockfish.stop();
// }, 5000);