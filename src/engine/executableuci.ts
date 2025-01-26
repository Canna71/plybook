import { Child, Command } from "@tauri-apps/plugin-shell";
import { IUCIInterface } from "./iuciinterface";
import { isWindows } from "../models/osutils";
import anylogger from "anylogger";
const log = anylogger("uciengine");
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

    private async getEngineCommand() {
        if(isWindows()) {
            return  Command.create("exec-cmd", ["/c", `${this.enginePath}`]);
        } else {
            return  Command.create("exec-sh", ["-c", `"${this.enginePath}"`]);
        }

        
    }

    async init(): Promise<void> {

        if (this.isReady) return;

        this.command = await this.getEngineCommand();
        
        this.command.stdout.on('data', (line: string) => {
            if (line.includes('uciok')) {
                this.isReady = true;
            }

            this.responseCallback?.(line);
        });

        this.command.stderr.on('data', (line: string) => {
            log.error(`Engine error: ${line}`);
        });

        this.command.on('close', (_code) => {
            this.isReady = false;
            this.exited = true;
        });

        this.command.on('error', (err) => {
            log.error(`error: ${err}`);
        });

        this.child = await this.command.spawn();

        this.sendCommand('uci');

        // Wait for the engine to be ready
        while (!this.isReady && !this.exited) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    sendCommand(command: string): void {
        log.debug(`Sending command: ${command}`);
        this.child?.write(command + '\n');
    }

    onResponse(callback: (line: string) => void): void {
        this.responseCallback = callback;
    }

    close(): void {
        this.child?.kill();
    }
}
