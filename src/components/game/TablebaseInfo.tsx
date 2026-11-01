import {
    batch,
    Component,
    createResource,
    For,
    Show,
    useContext,
} from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import { parseUci } from "chessops";
import { Path } from "../../models/pgn";
import {
    MAX_PIECES,
    moveLabel,
    moveOutcome,
    pieceCount,
    Tablebase,
    verdict,
} from "../../models/tablebase";
import { GameContext } from "./GameContext";
import "./TablebaseInfo.scss";

// positions already asked about, so going back and forth costs no requests
const cache = new Map<string, Promise<Tablebase>>();
const lookup = (fen: string) => {
    const key = fen.split(" ").slice(0, 4).join(" ");
    if (!cache.has(key)) {
        const request = invoke<Tablebase>("online_tablebase", { fen });
        // a failure is not cached: it may be a network hiccup
        request.catch(() => cache.delete(key));
        cache.set(key, request);
    }
    return cache.get(key)!;
};

/** The exact result of endgames with up to 7 pieces, from the Lichess tablebase. */
const TablebaseInfo: Component = () => {
    const {
        gameSignal: [game, setGame],
        currentPathSignal: [currentPath, setCurrentPath],
    } = useContext(GameContext)!;

    const data = () => game()?.dataAt(currentPath() ?? Path.root);
    const fen = () => {
        const f = data()?.fen;
        return f && pieceCount(f) <= MAX_PIECES ? f : undefined;
    };
    const [answer] = createResource(fen, (f) =>
        lookup(f).then(
            (tb) => ({ fen: f, tb }),
            (err) => ({ fen: f, error: String(err) }),
        ),
    );
    // a resource keeps its last value while the next loads: never show one position's answer
    // on another
    const result = () => (answer()?.fen === fen() ? answer() : undefined);

    const play = (uci: string) => {
        const g = game();
        const move = parseUci(uci);
        if (!g || !move) return;
        const [next, path] = g.applyMoves(currentPath() ?? Path.root, [move]);
        batch(() => {
            setGame(next);
            setCurrentPath(path);
        });
    };

    return (
        <Show when={fen()}>
            <div class="tablebase-info">
                <Show
                    when={result() && "tb" in result()! && result()!}
                    fallback={
                        <span class="tablebase-note">
                            {result() && "error" in result()!
                                ? `Tablebase: ${(result() as { error: string }).error}`
                                : "Tablebase…"}
                        </span>
                    }
                >
                    {(r) => {
                        const tb = (r() as { tb: Tablebase }).tb;
                        return (
                            <>
                                <div class="tablebase-verdict">
                                    Tablebase: {verdict(tb, data()!.turn)}
                                </div>
                                <div class="tablebase-moves">
                                    <For each={tb.moves.slice(0, 8)}>
                                        {(m) => (
                                            <span
                                                class={`tablebase-move ${moveOutcome(m)}`}
                                                title={moveLabel(m)}
                                                onClick={() => play(m.uci)}
                                            >
                                                {m.san}
                                            </span>
                                        )}
                                    </For>
                                </div>
                            </>
                        );
                    }}
                </Show>
            </div>
        </Show>
    );
};

export default TablebaseInfo;
