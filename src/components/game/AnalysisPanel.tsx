// The panel beside the board (UX overhaul, step 4): one toolbar, then sections that fold
// (PanelSection): Engine, Moves, About this position, Game review, Explorer. Split out of
// GameManager; it reads the game from GameContext and takes the engine's output as props.

import { Accessor, Component, Show, useContext } from "solid-js";
import { EngineInfo } from "../../engine/engineinterfaces";
import { MoveStat } from "../../engine/lc0";
import { activeProfile } from "../../engine/engineprofiles";
import { GameContext } from "./GameContext";
import { ViewMode } from "./PgnEditBar";
import PgnEditBar from "./PgnEditBar";
import EngineControl from "./EngineControl";
import PanelSection from "./PanelSection";
import WhatIf from "./WhatIf";
import EngineInfoViewer from "./EngineInfoViewer";
import Moves from "./Moves";
import ButtonBar from "./Buttonbar";
import PositionFacts from "./PositionFacts";
import HumanMoves from "./HumanMoves";
import TablebaseInfo from "./TablebaseInfo";
import ReviewPanel from "./ReviewPanel";
import Explorer from "./Explorer";
import PgnTextArea from "./PgnTextArea";

const AnalysisPanel: Component<{
    engineInfo: EngineInfo[];
    /** The engine is analysing (switched on, not playing, not reviewing) */
    engineCallable: Accessor<boolean>;
    humanMoves: Accessor<MoveStat[]>;
    humanProfileName: Accessor<string | undefined>;
    fen: Accessor<string>;
    hasMoves: Accessor<boolean>;
    isEditable: Accessor<boolean>;
}> = (props) => {
    const {
        viewModeSignal: [viewMode],
        editPgnSignal: [editPgn, setEditPgn],
        isPlayingOnSignal: [isPlayingOn],
        playingEngine,
        isPuzzleMode,
        isReviewing,
        threatFen,
    } = useContext(GameContext)!;

    const analysing = () =>
        props.engineCallable() &&
        !playingEngine() &&
        !isReviewing() &&
        !isPuzzleMode();

    return (
        <div class="pgnviewer-sidebar">
            {/* one toolbar: the engine on the left, the game's tools on the right */}
            <Show when={!isPuzzleMode()}>
                <div class="workspace-toolbar">
                    <Show when={viewMode() === ViewMode.MOVES}>
                        <EngineControl />
                    </Show>
                    <PgnEditBar isEditable={props.isEditable} />
                </div>
            </Show>

            <Show when={analysing()}>
                <PanelSection id="engine" title="Engine">
                    <Show when={!threatFen()}>
                        <WhatIf engineInfo={props.engineInfo} />
                    </Show>
                    <EngineInfoViewer engineInfo={props.engineInfo} />
                    <Show when={!props.engineInfo.length}>
                        <p class="panel-hint">
                            {activeProfile()?.singleNode
                                ? `${activeProfile()!.name} plays like a human and gives no evaluation. For engine lines, choose a full-strength engine such as Stockfish in Settings.`
                                : "Thinking…"}
                        </p>
                    </Show>
                </PanelSection>
            </Show>

            <Show when={viewMode() === ViewMode.MOVES && !isPuzzleMode()}>
                <PanelSection id="moves" title="Moves" grow>
                    <Show
                        when={props.hasMoves()}
                        fallback={
                            <p class="panel-hint">
                                {playingEngine()
                                    ? "Choose the engine's colour and start a new game."
                                    : "Make a move on the board, or paste a PGN or a FEN (⌘V)."}
                            </p>
                        }
                    >
                        <div class="pgnviewer-moves-wrapper">
                            <Moves />
                        </div>
                    </Show>
                    <ButtonBar />
                </PanelSection>
            </Show>

            <Show when={analysing() && viewMode() === ViewMode.MOVES}>
                <PanelSection id="insights" title="About this position">
                    <PositionFacts />
                    <HumanMoves
                        moves={props.humanMoves()}
                        name={props.humanProfileName()}
                        fen={props.fen()}
                        engineInfo={props.engineInfo}
                    />
                    <TablebaseInfo />
                </PanelSection>
            </Show>

            <Show
                when={
                    !isPlayingOn() &&
                    !isPuzzleMode() &&
                    viewMode() === ViewMode.MOVES
                }
            >
                <PanelSection
                    id="review"
                    title="Game review"
                    defaultOpen={false}
                >
                    <ReviewPanel />
                </PanelSection>
                <PanelSection
                    id="explorer"
                    title="Explorer"
                    defaultOpen={false}
                >
                    <Explorer />
                </PanelSection>
            </Show>

            <Show when={viewMode() === ViewMode.PGN}>
                <PgnTextArea pgnSignal={[editPgn, setEditPgn]} />
            </Show>
        </div>
    );
};

export default AnalysisPanel;
