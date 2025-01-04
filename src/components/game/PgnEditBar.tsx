import {
    Component,
    useContext,
    batch,
    Show,
} from "solid-js";
import Button from "../common/Button";
import { GameContext } from "./GameContext";
import { updateGameFromPgnString } from "../common/utils";
import ToggleSwitch from "../common/ToggleSwitch";
import { StartingPositionIcon } from "../common/Icons";
import { IconBrackets, IconCheck, IconTextPlus } from "@tabler/icons-solidjs";

export enum ViewMode {
    STARTING_POSITION,
    MOVES,
    PGN
}

type SetPositionSwitchProps = {
    // viewMode: Accessor<ViewMode>;
    // onEditStartingPosition: () => void;
    // onAcceptStartingPosition: () => void;
    // onCancelStartingPosition: () => void;
};

const PgnEditBar: Component<SetPositionSwitchProps> = () => {
    const gameContext = useContext(GameContext)!;
    const {
        viewModeSignal: [viewMode, setViewMode],
        startingPositionSignal: [startingPosition],
        gameSignal: [game, setGame],
        editPgnSignal: [editPgn, setEditPgn],
        isEditingDescriptionSignal: [isEditingDescription, setIsEditingDescription],
        engineOnSignal,
    } = gameContext;

    const onEditStartingPosition = () => {
        setViewMode(ViewMode.STARTING_POSITION);
    };

    const onAcceptStartingPosition = () => {
        const newGame = game()?.updateHeaders(
            new Map([
                ["FEN", startingPosition() || ""],
                ["Setup", "1"],
            ]),
        );
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
            console.log("editPgn", editPgn());
            updateGameFromPgnString(editPgn()!, gameContext);
            setViewMode(ViewMode.MOVES);
        });
    }

    const onEditDescription = () => {
        setIsEditingDescription(true);
    };

    const onFinishEditDescription = () => {
        setIsEditingDescription(false);
    };

    return (
        <div class="buttons-bar buttons are-small">
            <ToggleSwitch toggleSignal={engineOnSignal} />

            <Show when={isEditingDescription()}>
                <Button onClick={onFinishEditDescription} title="Finish Editing Description">
                    <IconCheck />
                </Button>
            </Show>

            <Show when={!isEditingDescription()}>
                <Button onClick={onEditDescription} title="Edit Description">
                    <IconTextPlus />
                </Button>
            </Show>


            <Show when={viewMode() === ViewMode.MOVES}>
                <Button onClick={onEditStartingPosition} title="Change Starting Position" >
                    <StartingPositionIcon />
                </Button>
            </Show>
            <Show when={viewMode() === ViewMode.MOVES}>
                <Button onClick={onEditPgn} title="Edit PGN" >
                    <IconBrackets />
                </Button>
            </Show>
            <Show when={viewMode() === ViewMode.STARTING_POSITION}>
                <div class="is-flex is-flex-direction-row is-gap-1">
                    <Button onClick={onCancelStartingPosition}>Cancel</Button>
                    <Button class="is-primary" onClick={onAcceptStartingPosition}>Accept</Button>
                </div>
            </Show>
            <Show when={viewMode() === ViewMode.PGN}>
                <div class="is-flex is-flex-direction-row is-gap-1">
                    <Button onClick={onCancelStartingPosition}>Cancel</Button>
                    <Button class="is-primary" onClick={onAcceptPgn}>Accept</Button>
                </div>
            </Show>
        </div>
    );
};

export default PgnEditBar;
