/* @refresh reload */
import { render } from "solid-js/web";
import App from "./App";
import { initStorage } from "./storage/fs";
import { initDB } from "./storage/db";
import "ulog";

await initStorage();
// not awaited: the UI can render while the database opens
initDB();

document.getElementById("root")!.innerHTML = "";
render(
    () => <App />,

    document.getElementById("root") as HTMLElement,
);
