import { ParentComponent } from "solid-js";
import Sidebar from "./Sidebar";
import "./Layout.scss";
import { VDivider } from "../components/common/VDivider";
import { useSplitter } from "../components/common/utils";

const Layout : ParentComponent = (props) => {
    const divider = useSplitter();
    return (
        <main class="layout-container">

            <aside class="sidebar">
                <Sidebar />
            </aside>

            <VDivider ref={divider} />

            <main class="main-content">
                
                {props.children}
            </main>




        </main>
    );
};

export default Layout;