import { Accessor, Component, Setter, Show } from "solid-js";
import "./ToggleSwitch.scss"; // Import the custom SASS file

export type ToggleSwitchProps = {
  isToggled: Accessor<boolean>;
  setIsToggled: Setter<boolean>;
  labels?: [string, string];
};

const ToggleSwitch: Component<ToggleSwitchProps> = ({ isToggled, setIsToggled, labels }) => {


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
