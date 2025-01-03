import { Accessor, Component, Setter, Show, Signal } from "solid-js";
import "./ToggleSwitch.scss"; // Import the custom SASS file

export type ToggleSwitchProps = {
  toggleSignal: Signal<boolean>;
  labels?: [string, string];
};

const ToggleSwitch: Component<ToggleSwitchProps> = ({ toggleSignal:[isToggled, setIsToggled], labels }) => {


  const toggle = () => setIsToggled(!isToggled());

  return (
    <div class="toggle-container">
      <div
        class={`toggle-switch ${isToggled() ? "toggled" : ""}`}
        onClick={toggle}
      >
        <div class="toggle-circle"></div>
      </div>
      <Show when={labels}>
        <span class="toggle-label">{isToggled() ? labels![1] : labels![0]}</span>
      </Show>
    </div>
  );
}

export default ToggleSwitch;
