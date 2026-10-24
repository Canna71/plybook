import { onCleanup, onMount, ParentComponent } from "solid-js";
import { useNavigate } from "@solidjs/router";
import Sidebar from "./Sidebar";
import { pastedImage, setPendingScan } from "../scan/pendingScan";
import "./Layout.scss";
import { VDivider } from "../components/common/VDivider";
import { useSplitter } from "../components/common/utils";
import { getSettingValue, setSettingValue } from "../models/settings";

const Layout: ParentComponent = (props) => {
    const divider = useSplitter((layout) => {
        setSettingValue("layout.columnsTemplate", layout);
    });

    // a screenshot pasted anywhere (outside text fields) is scanned for a position
    const navigate = useNavigate();
    const onPaste = (e: ClipboardEvent) => {
        const image = pastedImage(e);
        if (!image) return;
        e.preventDefault();
        setPendingScan(image);
        navigate("/scan");
    };
    onMount(() => document.addEventListener("paste", onPaste));
    onCleanup(() => document.removeEventListener("paste", onPaste));

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
