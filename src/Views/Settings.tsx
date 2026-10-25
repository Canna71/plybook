import { Component } from "solid-js";
import EngineSettings from "../components/settings/EngineSettings";
import OnlineAccounts from "../components/settings/OnlineAccounts";
import LichessToken from "../components/settings/LichessToken";
import OpeningBooks from "../components/settings/OpeningBooks";
import Backups from "../components/settings/Backups";
import Appearance from "../components/settings/Appearance";
import PageHeader from "../components/shell/PageHeader";
import "./Settings.scss";

const Settings: Component = () => (
    <div class="settings_view">
        <PageHeader title="Settings" />
        <Appearance />
        <EngineSettings />
        <OpeningBooks />
        <OnlineAccounts />
        <LichessToken />
        <Backups />
    </div>
);

export default Settings;
