import { Channel, invoke } from "@tauri-apps/api/core";
import { IUCIInterface } from "./iuciinterface";
import { isMacOS } from "../models/osutils";
import anylogger from "anylogger";
const log = anylogger("uciengine");

// Mirrors EngineEvent in src-tauri/src/engine.rs
type EngineEvent =
    | { event: "stdout"; data: string }
    | { event: "stderr"; data: string }
    | { event: "error"; data: string }
    | {
          event: "terminated";
          data: { code: number | null; signal: number | null };
      };

// How long a freshly started engine has to answer "uci" with "uciok".
const UCI_HANDSHAKE_TIMEOUT_MS = 10000;
const SIGKILL = 9;

// ExecutableUCIInterface.ts
// The engine process is owned by the Rust side (see src-tauri/src/engine.rs);
// the webview only refers to it by the id of an engine profile.
export class ExecutableUCIInterface implements IUCIInterface {
    private pid?: number;
    private responseCallback?: (line: string) => void;
    private engineId: string;
    private engineName: string;
    private isReady = false;
    private exited = false;
    private exitInfo?: { code: number | null; signal: number | null };
    private lastStderr: string[] = [];

    constructor(engineId: string, engineName: string) {
        this.engineId = engineId;
        this.engineName = engineName;
    }

    private onEvent(message: EngineEvent) {
        switch (message.event) {
            case "stdout":
                if (message.data.includes("uciok")) {
                    this.isReady = true;
                }
                this.responseCallback?.(message.data);
                break;
            case "stderr":
                log.error(`Engine error: ${message.data}`);
                this.lastStderr = [...this.lastStderr, message.data].slice(-3);
                break;
            case "error":
                log.error(`error: ${message.data}`);
                break;
            case "terminated":
                this.isReady = false;
                this.exited = true;
                this.exitInfo = message.data;
                break;
        }
    }

    private failureMessage(): string {
        const { code, signal } = this.exitInfo ?? { code: null, signal: null };
        let msg = `The engine ${this.engineName} stopped before it was ready`;
        msg +=
            signal !== null
                ? ` (signal ${signal}).`
                : code !== null
                  ? ` (exit code ${code}).`
                  : ".";
        if (this.lastStderr.length > 0) {
            msg += ` It reported: ${this.lastStderr.join(" ")}`;
        }
        if (isMacOS() && signal === SIGKILL) {
            msg +=
                " macOS probably blocked it because it was downloaded from the internet: open it once from Finder (right-click > Open), or allow it in System Settings > Privacy & Security.";
        }
        return msg;
    }

    async init(): Promise<void> {
        if (this.isReady) return;

        const onEvent = new Channel<EngineEvent>();
        onEvent.onmessage = (message) => this.onEvent(message);

        // Rejects with a readable message if the engine is missing or cannot be started.
        this.pid = await invoke<number>("engine_spawn", {
            id: this.engineId,
            onEvent,
        });

        this.sendCommand("uci");

        // Wait for the engine to be ready
        const deadline = Date.now() + UCI_HANDSHAKE_TIMEOUT_MS;
        while (!this.isReady && !this.exited) {
            if (Date.now() > deadline) {
                this.close();
                throw new Error(
                    `The engine ${this.engineName} did not answer as a UCI chess engine within ${UCI_HANDSHAKE_TIMEOUT_MS / 1000} seconds.`,
                );
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        if (!this.isReady) {
            throw new Error(this.failureMessage());
        }
    }

    sendCommand(command: string): void {
        log.debug(`Sending command: ${command}`);
        if (this.pid === undefined || this.exited) return;
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
