/* @refresh reload */
import { render } from "solid-js/web";
import App from "./App";
import { initStorage } from "./storage/fs";
import { initDB } from "./storage/db";
import { scheduleAutoBackup } from "./storage/backup";
import { scheduleAutoSync } from "./online/autosync";
import { scheduleUpdateCheck } from "./storage/updates";
import "ulog";

await initStorage();
scheduleUpdateCheck();
// not awaited: the UI can render while the database opens
initDB().then(() => {
    scheduleAutoBackup();
    scheduleAutoSync();
});

document.getElementById("root")!.innerHTML = "";
render(
    () => <App />,

    document.getElementById("root") as HTMLElement,
);
