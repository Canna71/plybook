import { Child, Command } from "@tauri-apps/plugin-shell";
import { IUCIInterface } from "./iuciinterface";

// ExecutableUCIInterface.ts
export class ExecutableUCIInterface implements IUCIInterface {
    private command?: Command<string>;
    private child?: Child;
    private responseCallback?: (line: string) => void;
    private enginePath: string;
    private isReady = false;
    private exited = false;

    constructor(enginePath: string) {
        this.enginePath = enginePath;
    }

    async init(): Promise<void> {

        if (this.isReady) return;

        this.command = await Command.create('exec-sh', ["-c", `"${this.enginePath}"`]);
        
        this.command.stdout.on('data', (line: string) => {
            if (line.includes('uciok')) {
                this.isReady = true;
            }

            this.responseCallback?.(line);
        });

        this.command.stderr.on('data', (line: string) => {
            console.error(`Engine error: ${line}`);
        });

        this.command.on('close', (code) => {
            console.log(`child process exited with code `, code);
            this.isReady = false;
            this.exited = true;
        });

        this.command.on('error', (err) => {
            console.error(`error: ${err}`);
        });

        this.child = await this.command.spawn();

        this.sendCommand('uci');

        // Wait for the engine to be ready
        while (!this.isReady && !this.exited) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    sendCommand(command: string): void {
        this.child?.write(command + '\n');
    }

    onResponse(callback: (line: string) => void): void {
        this.responseCallback = callback;
    }

    close(): void {
        this.child?.kill();
    }
}
