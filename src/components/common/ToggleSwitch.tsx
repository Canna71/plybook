import { Accessor, Component, createSignal, Setter } from "solid-js";
import "./ToggleSwitch.scss"; // Import the custom SASS file

export type ToggleSwitchProps = {
  isToggled: Accessor<boolean>;
  setIsToggled: Setter<boolean>;
};

const ToggleSwitch : Component<ToggleSwitchProps> = ({isToggled, setIsToggled}) => {


  const toggle = () => setIsToggled(!isToggled());

  return (
    <div class="toggle-container">
      <div
        class={`toggle-switch ${isToggled() ? "toggled" : ""}`}
        onClick={toggle}
      >
        <div class="toggle-circle"></div>
      </div>
      <span class="toggle-label">{isToggled() ? "ON" : "OFF"}</span>
    </div>
  );
}

export default ToggleSwitch;
