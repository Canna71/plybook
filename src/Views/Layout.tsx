import { ParentComponent } from "solid-js";
import Sidebar from "./Sidebar";


const Layout : ParentComponent = (props) => {
    return (
        <main class="container">

            <aside class="sidebar">
                <Sidebar />
            </aside>

            <main class="main-content">
                
                {props.children}
            </main>




        </main>
    );
};

export default Layout;