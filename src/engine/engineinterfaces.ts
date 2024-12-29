// types.ts
export interface AnalysisOptions {
    depth?: number;
    movetime?: number;
    multipv?: number;
}

// Types for the parsed information
export type Score = {
    type: "cp" | "mate";
    value: number;
};

export type EngineInfo = {
    multipv?: number; // Line number (1, 2, 3, etc.)
    depth?: number; // Search depth
    score?: Score; // Position evaluation
    pv?: string[]; // Line of moves
    nodes?: number; // Nodes searched
    nps?: number; // Nodes per second
    time?: number; // Time spent in ms
    currmove?: string; // Current move being analyzed
    currmovenumber?: number; // Move number in the search
    hashfull?: number; // Hash table usage per thousand
    tbhits?: number; // Tablebase hits
    seldepth?: number; // Selective search depth
};

// IChessEngine.ts
export interface IChessEngine extends IEngineEventEmitter {
    init(): Promise<void>;
    // analyzePosition(fen: string, options: AnalysisOptions): void;
    analyzeFromFenOrMoves(
        fenOrMoves: string[] | string,
        options: AnalysisOptions,
    ): void;
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
