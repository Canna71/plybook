import { Component } from "solid-js";
import "./FailureIcon.scss";

const FailureIcon: Component<{}> = (props) => {
  
  return <div>
    <div class="failure-icon modal-icon">
      <div class="failure-icon__tip"></div>
      <div class="failure-icon__long"></div>
    </div>
  </div>;
};

export default FailureIcon;