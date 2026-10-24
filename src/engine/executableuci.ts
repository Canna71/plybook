import { Channel, invoke } from "@tauri-apps/api/core";
import { IUCIInterface } from "./iuciinterface";
import anylogger from "anylogger";
const log = anylogger("uciengine");

type EngineEvent =
    | { event: "stdout"; data: string }
    | { event: "stderr"; data: string }
    | { event: "error"; data: string }
    | { event: "terminated"; data: { code: number | null } };

// ExecutableUCIInterface.ts
// The engine process is owned by the Rust side (see src-tauri/src/engine.rs);
// the webview only refers to it by file name in the Engines folder.
export class ExecutableUCIInterface implements IUCIInterface {
    private pid?: number;
    private responseCallback?: (line: string) => void;
    private engineName: string;
    private isReady = false;
    private exited = false;

    constructor(engineName: string) {
        this.engineName = engineName;
    }

    async init(): Promise<void> {
        if (this.isReady) return;

        const onEvent = new Channel<EngineEvent>();
        onEvent.onmessage = (message) => {
            switch (message.event) {
                case "stdout":
                    if (message.data.includes("uciok")) {
                        this.isReady = true;
                    }
                    this.responseCallback?.(message.data);
                    break;
                case "stderr":
                    log.error(`Engine error: ${message.data}`);
                    break;
                case "error":
                    log.error(`error: ${message.data}`);
                    break;
                case "terminated":
                    this.isReady = false;
                    this.exited = true;
                    break;
            }
        };

        try {
            this.pid = await invoke<number>("engine_spawn", {
                name: this.engineName,
                onEvent,
            });
        } catch (e) {
            log.error(`cannot start engine: ${e}`);
            this.exited = true;
            return;
        }

        this.sendCommand("uci");

        // Wait for the engine to be ready
        while (!this.isReady && !this.exited) {
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }

    sendCommand(command: string): void {
        log.debug(`Sending command: ${command}`);
        if (this.pid === undefined) return;
        invoke("engine_write", { pid: this.pid, data: command + "\n" }).catch(
            (e) => log.error(`cannot write to engine: ${e}`),
        );
    }

    onResponse(callback: (line: string) => void): void {
        this.responseCallback = callback;
    }

    close(): void {
        if (this.pid === undefined) return;
        invoke("engine_kill", { pid: this.pid }).catch((e) =>
            log.error(`cannot stop engine: ${e}`),
        );
    }
}
