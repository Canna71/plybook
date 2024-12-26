/* @refresh reload */
import { render } from "solid-js/web";
import App from "./App";
import { initStorage } from "./storage/fs";

await initStorage();

render(
    () => (
        <App />
    ), 

document.getElementById("root") as HTMLElement);


