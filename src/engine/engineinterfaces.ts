// types.ts
export interface AnalysisOptions {
    depth?: number;
    movetime?: number;
    multipv?: number;
}

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

// IChessEngine.ts
export interface IChessEngine extends IEngineEventEmitter {
    init(): Promise<void>;
    // analyzePosition(fen: string, options: AnalysisOptions): void;
    analyzeFromFenOrMoves(fenOrMoves: string[] | string, options: AnalysisOptions): void;
    stop(): void;
    quit(): void;
    newGame(): void;
    setOption(name: string, value: any): void;
}

// IEngineEventEmitter.ts
export interface IEngineEventEmitter {
    on(event: string, callback: Function): void;
    off(event: string, callback: Function): void;
    // emit(event: string, ...args: any[]): void;
}
