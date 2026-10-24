import "./styles/App.scss";
import { Router, Route } from "@solidjs/router";
import Home from "./Views/Home";
import Layout from "./Views/Layout";
import BoardEditorView from "./Views/BoardEditorView";
import GameView from "./Views/GameView";
import { useThemes } from "./theming/thememanager";
import Play from "./Views/Play";
import {
    ContentContext,
    useContentContext,
} from "./components/common/ContentContext";
import { Toaster } from "solid-toast";
import Puzzles from "./Views/Puzzles";
import LibraryFolder from "./Views/LibraryFolder";
import History from "./Views/History";
import Settings from "./Views/Settings";
import GuessTheMove from "./Views/GuessTheMove";
import Databases from "./Views/Databases";
import ScanView from "./Views/ScanView";
import Repertoires from "./Views/Repertoires";
import RepertoireTrainer from "./Views/RepertoireTrainer";

function App() {
    // const [greetMsg, setGreetMsg] = createSignal("");
    // const [name, setName] = createSignal("");

    // async function greet() {
    //   // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    //   setGreetMsg(await invoke("greet", { name: name() }));
    // }

    // dynamically load css in assets folder
    useThemes();

    const contentContext = useContentContext();

    return (
        <ContentContext.Provider value={contentContext}>
            <Router root={Layout}>
                <Route path="/" component={Home} />
                <Route
                    path="/game"
                    component={GameView}
                    info={{ engine: false }}
                />
                <Route path="/boardeditor" component={BoardEditorView} />
                <Route path="/play" component={Play} />
                <Route path="/library" component={LibraryFolder} />
                <Route path="/history" component={History} />
                <Route path="/settings" component={Settings} />
                <Route path="/guess" component={GuessTheMove} />
                <Route path="/databases" component={Databases} />
                <Route path="/scan" component={ScanView} />
                <Route path="/repertoires" component={Repertoires} />
                <Route path="/repertoire" component={RepertoireTrainer} />

                <Route
                    path="/analysis"
                    component={GameView}
                    info={{ engine: true }}
                />
                <Route
                    path="/puzzles"
                    component={Puzzles}
                    info={{ puzzle: true }}
                />
                <Route
                    path="/puzzle"
                    component={GameView}
                    info={{ puzzle: true }}
                />
            </Router>
            <Toaster containerClassName="toaster-container" />
        </ContentContext.Provider>
    );
}

export default App;
