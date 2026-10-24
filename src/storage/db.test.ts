import { beforeEach, describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", () => ({ invoke }));

const { saveHistoryGame } = await import("./db");

const STARTED =
    '[White "Player"]\n[Black "maia-1100"]\n[Result "*"]\n' +
    '[Timestamp "2026-10-24T14:15:26.208Z"]\n';

describe("saveHistoryGame", () => {
    beforeEach(() => {
        invoke.mockReset();
        invoke.mockResolvedValue({});
    });

    it("saves a game in progress under its Timestamp id", async () => {
        const pgn = STARTED + "\n1. e4 e5 *";
        await saveHistoryGame(pgn);
        expect(invoke).toHaveBeenCalledWith("save_history_game", {
            id: "20261024T141526208Z",
            pgn,
        });
    });

    it("skips games without moves or without a Timestamp", async () => {
        await saveHistoryGame(STARTED + "\n*");
        await saveHistoryGame('[White "Player"]\n\n1. e4 *');
        expect(invoke).not.toHaveBeenCalledWith(
            "save_history_game",
            expect.anything(),
        );
    });

    it("keeps the id of an existing record", async () => {
        await saveHistoryGame(STARTED + "\n1. e4 *", "kleejb36la9p9su23aeq");
        expect(invoke).toHaveBeenCalledWith(
            "save_history_game",
            expect.objectContaining({ id: "kleejb36la9p9su23aeq" }),
        );
    });

    it("does not throw when the database fails", async () => {
        invoke.mockImplementation(async () => {
            throw new Error("Database not initialized");
        });
        expect(await saveHistoryGame(STARTED + "\n1. e4 *")).toBeUndefined();
    });
});
