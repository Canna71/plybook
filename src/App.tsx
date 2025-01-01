import "./styles/App.scss";
import { Router, Route } from "@solidjs/router";
import Home from "./Views/Home";
import Layout from "./Views/Layout";
import BoardEditorView from "./Views/BoardEditorView";
import DBTest from "./Views/DBTest";
import PlayEngineTest from "./Views/obsoleted/PlayEgineTest";
import AnalysisView from "./Views/obsoleted/AnalysisView";
import GameView from "./Views/GameView";
import { useThemes } from "./theming/thememanager";
import Play from "./Views/Play";
import { Accessor, createContext, createSignal, Setter } from "solid-js";

interface ContentContext {
    refreshTrigger: Accessor<number>;
    setRefreshTrigger: Setter<number>;
}

const ContentContext = createContext();

function App() {
    // const [greetMsg, setGreetMsg] = createSignal("");
    // const [name, setName] = createSignal("");

    // async function greet() {
    //   // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    //   setGreetMsg(await invoke("greet", { name: name() }));
    // }

    // This will be our trigger for updates
    const [refreshTrigger, setRefreshTrigger] = createSignal(0);

    // dynamically load css in assets folder
    useThemes();

    return (
        <ContentContext.Provider value={{ refreshTrigger, setRefreshTrigger }}>
            <Router root={Layout}>
                <Route path="/" component={Home} />
                <Route
                    path="/game"
                    component={GameView}
                    info={{ engine: false }}
                />
                <Route path="/boardeditor" component={BoardEditorView} />
                <Route path="/db" component={DBTest} />
                <Route path="/play" component={Play} />
                <Route
                    path="/analysis"
                    component={GameView}
                    info={{ engine: true }}
                />
            </Router>
        </ContentContext.Provider>
    );
}

export default App;
