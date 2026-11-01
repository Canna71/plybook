import { Component, For, Show, useContext } from "solid-js";
import { Chess, parseUci } from "chessops";
import { parseFen } from "chessops/fen";
import { makeSan } from "chessops/san";
import { EngineInfo } from "../../engine/engineinterfaces";
import { MoveStat } from "../../engine/lc0";
import { judgeHumanMove } from "../../models/human";
import { GameContext } from "./GameContext";
import "./HumanMoves.scss";

const sanIn = (fen: string, uci: string) => {
    const setup = parseFen(fen);
    const pos = setup.isOk ? Chess.fromSetup(setup.value) : undefined;
    const move = parseUci(uci);
    return pos?.isOk && move && pos.value.isLegal(move)
        ? makeSan(pos.value, move)
        : uci;
};

const sameFen = (a?: string, b?: string) =>
    !!a &&
    !!b &&
    a.split(" ").slice(0, 4).join(" ") === b.split(" ").slice(0, 4).join(" ");

/** What players at the Maia net's level would play here, next to the engine's view. */
const HumanMoves: Component<{
    moves: MoveStat[];
    name?: string;
    fen: string;
    engineInfo: EngineInfo[];
}> = (props) => {
    const { analyzedFen } = useContext(GameContext)!;
    const turn = () => (props.fen.split(" ")[1] === "b" ? "black" : "white");
    // engine lines count only once they are for this position
    const lines = () =>
        sameFen(analyzedFen(), props.fen) ? props.engineInfo : [];
    const verdict = () => {
        const top = props.moves[0];
        return top && judgeHumanMove(top.uci, lines(), turn());
    };
    const topSan = () => sanIn(props.fen, props.moves[0].uci);
    const bestSan = () => {
        const best = lines()[0]?.pv?.[0];
        return best && sanIn(props.fen, best);
    };

    return (
        <Show when={props.moves.length > 0}>
            <div class="human-moves">
                <div title="How often players at this level choose each move (Maia)">
                    {props.name ?? "Humans"}:{" "}
                    <For each={props.moves}>
                        {(move, i) => (
                            <>
                                {i() > 0 && " · "}
                                <span class="human-move">
                                    {sanIn(props.fen, move.uci)}
                                </span>{" "}
                                {move.policy.toFixed(0)}%
                                {move.uci === lines()[0]?.pv?.[0] && (
                                    <span title="The engine's choice"> ⭐</span>
                                )}
                            </>
                        )}
                    </For>
                </div>
                <Show when={verdict()?.kind === "trap"}>
                    <div class="human-trap">
                        Trap: most players play {topSan()}, which loses{" "}
                        {(verdict() as { loss: number }).loss.toFixed(0)}%
                        winning chances. The engine prefers {bestSan()}.
                    </div>
                </Show>
                <Show when={verdict()?.kind === "unranked"}>
                    <div class="human-note">
                        Most players play {topSan()}; the engine does not rank
                        it among its lines.
                    </div>
                </Show>
            </div>
        </Show>
    );
};

export default HumanMoves;
