import { Component, useContext, batch, Show, Accessor, createMemo } from "solid-js";
import Button from "../common/Button";
import { GameContext } from "./GameContext";
import { getPosition, initFromGameModel, updateGameFromPgnString, useFen } from "../common/utils";
import ToggleSwitch from "../common/ToggleSwitch";
import { StartingPositionIcon } from "../common/Icons";
import {
    IconBrackets,
    IconCheck,
    IconCpu,
    IconSwitchVertical,
    IconTextPlus,
} from "@tabler/icons-solidjs";
import { useNavigate } from "@solidjs/router";

export enum ViewMode {
    STARTING_POSITION,
    MOVES,
    PGN,
}

type PgnEditBarProps = {
    isEditable: Accessor<boolean>;
};

const PgnEditBar: Component<PgnEditBarProps> = (props) => {
    const gameContext = useContext(GameContext)!;
    const {
        viewModeSignal: [viewMode, setViewMode],
        startingPositionSignal: [startingPosition],
        gameSignal: [game, setGame],
        editPgnSignal: [editPgn, setEditPgn],
        isEditingDescriptionSignal: [
            isEditingDescription,
            setIsEditingDescription,
        ],
        orientation,
        currentPathSignal: [currentPath],
    } = gameContext;
    const navigate = useNavigate();

    const onEditStartingPosition = () => {
        setViewMode(ViewMode.STARTING_POSITION);
    };

    const onAcceptStartingPosition = () => {
        // const newGame = game()?.updateHeaders(
        //     new Map([
        //         ["FEN", startingPosition() || ""],
        //         ["Setup", "1"],
        //     ]),
        // );
        const newGame = game()?.withStartingPosition(startingPosition() || "");
        batch(() => {
            setGame(newGame);
            setViewMode(ViewMode.MOVES);
        });
    };

    const onCancelStartingPosition = () => {
        setViewMode(ViewMode.MOVES);
    };

    const onEditPgn = () => {
        batch(() => {
            setEditPgn(game()?.pgn());
            setViewMode(ViewMode.PGN);
        });
    };

    const onAcceptPgn = () => {
        batch(() => {
            updateGameFromPgnString(editPgn()!, gameContext);
            setViewMode(ViewMode.MOVES);
        });
    };

    const onEditDescription = () => {
        setIsEditingDescription(true);
    };

    const onFinishEditDescription = () => {
        setIsEditingDescription(false);
    };

    const onFLipBoard = () => {
        const newOrientation = orientation() === "white" ? "black" : "white";
        const newGame = game()?.updateHeaders(
            new Map([["Orientation", newOrientation]]),
        );
        // initFromGameModel(gameContext, newGame!);
        setGame(newGame);
    };

    const fen = useFen(game, currentPath);
    

    const onPlayAgainstEngine = () => {
        // setPlayingEngine(!playingEngine());
        const fenStr = fen();
        navigate(`/play?fen=${fenStr}`);
        
    }

    return (
        <div class="buttons-bar are-small">
            <Show when={props.isEditable()}>
                <Button onClick={onFLipBoard} title="Flip Board">
                    <IconSwitchVertical />
                </Button>

                <Show when={isEditingDescription()}>
                    <Button
                        onClick={onFinishEditDescription}
                        title="Finish Editing Description"
                    >
                        <IconCheck />
                    </Button>
                </Show>

                <Show when={!isEditingDescription()}>
                    <Button
                        onClick={onEditDescription}
                        title="Edit Description"
                    >
                        <IconTextPlus />
                    </Button>
                </Show>
                <Show when={viewMode() === ViewMode.MOVES}>
                    <Button onClick={onEditPgn} title="Edit PGN">
                        <IconBrackets />
                    </Button>
                    <Button title="Play Against Engine" onClick={onPlayAgainstEngine}>
                        <IconCpu />
                    </Button>

                </Show>
            </Show>

            <Show when={viewMode() === ViewMode.MOVES}>
                <Button
                    onClick={onEditStartingPosition}
                    title="Change Starting Position"
                >
                    <StartingPositionIcon />
                </Button>
            </Show>

            <Show when={viewMode() === ViewMode.STARTING_POSITION}>
                <div class="is-flex is-flex-direction-row is-gap-1">
                    <Button onClick={onCancelStartingPosition}>Cancel</Button>
                    <Button
                        class="is-primary"
                        onClick={onAcceptStartingPosition}
                    >
                        Accept
                    </Button>
                </div>
            </Show>
            <Show when={viewMode() === ViewMode.PGN}>
                <div class="is-flex is-flex-direction-row is-gap-1">
                    <Button onClick={onCancelStartingPosition}>Cancel</Button>
                    <Button class="is-primary" onClick={onAcceptPgn}>
                        Accept
                    </Button>
                </div>
            </Show>
        </div>
    );
};

export default PgnEditBar;
