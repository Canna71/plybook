import { ParentComponent } from "solid-js";
import Sidebar from "./Sidebar";
import "./Layout.scss";
import { VDivider } from "../components/common/VDivider";
import { useSplitter } from "../components/common/utils";
import { getSettingValue, setSettingValue } from "../models/settings";

const Layout: ParentComponent = (props) => {
    const divider = useSplitter((layout) => {
        setSettingValue("layout.columnsTemplate", layout);
    });

    const gridTemplateColumns = () =>
        getSettingValue("layout.columnsTemplate", "180px 5px 1fr");

    return (
        <main
            class="layout-container"
            style={{ "grid-template-columns": gridTemplateColumns() }}
        >
            <aside class="sidebar">
                <Sidebar />
            </aside>

            <VDivider ref={divider} />

            <main class="main-content">{props.children}</main>
        </main>
    );
};

export default Layout;
