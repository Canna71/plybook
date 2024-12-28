// IUCIInterface.ts
export interface IUCIInterface {
    sendCommand(command: string): void;
    onResponse(callback: (line: string) => void): void;
    init(): Promise<void>;
    close(): void;
}
