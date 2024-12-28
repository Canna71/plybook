import { AnalysisOptions, EngineInfo, IChessEngine, IEngineEventEmitter } from "./engineinterfaces";
import { IUCIInterface } from "./iuciinterface";

// UCIEngine.ts
export class UCIEngine implements IChessEngine, IEngineEventEmitter {
    private uciInterface: IUCIInterface;
    private isReady = false;
    private callbacks: Map<string, Function[]> = new Map();

    constructor(uciInterface: IUCIInterface) {
        this.uciInterface = uciInterface;
        this.uciInterface.onResponse(line => this.processEngineOutput(line));
    }
    analyzePosition(fen: string, options: AnalysisOptions): void {
        // throw new Error("Method not implemented.");
        this.uciInterface.sendCommand('stop');
        this.uciInterface.sendCommand(`position fen ${fen}`);
        let goCommand = 'go';
        if (options.depth) goCommand += ` depth ${options.depth}`;
        if (options.movetime) goCommand += ` movetime ${options.movetime}`;
        if (options.multipv) {
            this.setOption('MultiPV', options.multipv);
        }
        this.uciInterface.sendCommand(goCommand);
    }
    analyzeFromFenOrMoves(fenOrMoves: string[] | string, options: AnalysisOptions): void {
        this.uciInterface.sendCommand('stop');
        if (typeof fenOrMoves === 'string') {
            this.uciInterface.sendCommand(`position fen ${fenOrMoves}`);
        } else {
            this.uciInterface.sendCommand(`position startpos moves ${fenOrMoves.join(' ')}`);
        }
        let goCommand = 'go';
        if (options.depth) goCommand += ` depth ${options.depth}`;
        if (options.movetime) goCommand += ` movetime ${options.movetime}`;
        if (options.multipv) {
            this.setOption('MultiPV', options.multipv);
        }
        // wait 10 ms
        setTimeout(() => {
            this.uciInterface.sendCommand(goCommand);
        }, 10);


    }
    stop(): void {
        this.uciInterface.sendCommand('stop');
    }
    quit(): void {
        this.uciInterface.sendCommand('quit');
    }
    newGame(): void {
        this.uciInterface.sendCommand('ucinewgame');
    }
    setOption(name: string, value: any): void {
        this.uciInterface.sendCommand(`setoption name ${name} value ${value}`);
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
        this.callbacks.get(event)?.forEach(callback => callback(...args));
    }

    async init(): Promise<void> {
        await this.uciInterface.init();
        this.uciInterface.sendCommand('uci');

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
        const tokens = line.trim().split(' ');

        switch (tokens[0]) {
            case 'uciok':
                this.uciInterface.sendCommand('isready');
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
