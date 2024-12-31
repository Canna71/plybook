import { Accessor, Component, Switch, Match } from "solid-js";
import Button from "../common/Button";

export enum ViewMode {
    STARTING_POSITION,
    MOVES,
}


type SetPositionSwitchProps = {
    viewMode: Accessor<ViewMode>;
    onEditStartingPosition: () => void;
    onAcceptStartingPosition: () => void;
    onCancelStartingPosition: () => void;
};

const SetPositionSwitch: Component<SetPositionSwitchProps> = (props) => {
    return (
        <Switch>
            <Match when={props.viewMode() === ViewMode.MOVES}>
                <Button onClick={props.onEditStartingPosition}>
                    Set Starting Position
                </Button>
            </Match>
            <Match when={props.viewMode() === ViewMode.STARTING_POSITION}>
                <div class="is-flex is-flex-direction-row is-gap-1">
                    <Button onClick={props.onAcceptStartingPosition}>
                        Accept
                    </Button>
                    <Button onClick={props.onCancelStartingPosition}>
                        Cancel
                    </Button>
                </div>
            </Match>
        </Switch>
    );
};

export default SetPositionSwitch;