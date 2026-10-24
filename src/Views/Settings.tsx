import { Component } from "solid-js";
import EngineSettings from "../components/settings/EngineSettings";
import OnlineAccounts from "../components/settings/OnlineAccounts";
import "./Settings.scss";

const Settings: Component = () => (
    <div class="settings_view">
        <EngineSettings />
        <OnlineAccounts />
    </div>
);

export default Settings;
