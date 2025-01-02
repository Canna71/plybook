import {
    Accessor,
    Component,
    Switch,
    Match,
    useContext,
    batch,
} from "solid-js";
import Button from "../common/Button";
import { GameContext } from "./GameContext";

export enum ViewMode {
    STARTING_POSITION,
    MOVES,
}

type SetPositionSwitchProps = {
    // viewMode: Accessor<ViewMode>;
    // onEditStartingPosition: () => void;
    // onAcceptStartingPosition: () => void;
    // onCancelStartingPosition: () => void;
};

const SetPositionSwitch: Component<SetPositionSwitchProps> = (props) => {
    const {
        viewModeSignal: [viewMode, setViewMode],
        startingPositionSignal: [startingPosition],
        gameSignal: [game, setGame],
    } = useContext(GameContext)!;

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

    return (
        <Switch>
            <Match when={viewMode() === ViewMode.MOVES}>
                <Button onClick={onEditStartingPosition}>
                    Set Starting Position
                </Button>
            </Match>
            <Match when={viewMode() === ViewMode.STARTING_POSITION}>
                <div class="is-flex is-flex-direction-row is-gap-1">
                    <Button onClick={onAcceptStartingPosition}>Accept</Button>
                    <Button onClick={onCancelStartingPosition}>Cancel</Button>
                </div>
            </Match>
        </Switch>
    );
};

export default SetPositionSwitch;
