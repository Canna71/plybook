import "./styles/App.scss";
import { Router, Route } from "@solidjs/router";
import Home from "./Views/Home";
import Layout from "./Views/Layout";
import BoardEditorView from "./Views/BoardEditorView";
import DBTest from "./Views/DBTest";
import PlayEngineTest from "./Views/PlayEgineTest";
import AnalysisView from "./Views/AnalysisView";
import GameView from "./Views/GameView";
import { useThemes } from "./theming/thememanager";

function App() {
    // const [greetMsg, setGreetMsg] = createSignal("");
    // const [name, setName] = createSignal("");

    // async function greet() {
    //   // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    //   setGreetMsg(await invoke("greet", { name: name() }));
    // }



    // dynamically load css in assets folder
    useThemes();

    return (
        <Router root={Layout}>
            <Route path="/" component={Home} />
            <Route path="/game" component={GameView} />
            <Route path="/boardeditor" component={BoardEditorView} />
            <Route path="/db" component={DBTest} />
            <Route path="/playsf" component={PlayEngineTest} />
            <Route path="/analysis" component={AnalysisView} />
        </Router>
    );
}

export default App;
