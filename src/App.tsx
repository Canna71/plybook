
import "./styles/App.scss";
import { Router, Route } from "@solidjs/router";
import Home from "./Views/Home";
import Layout from "./Views/Layout";
import Viewer from "./Views/Viewer";
import PgnView from "./Views/PgnView";
import Editor from "./Views/Editor";
import Play from "./Views/Play";
import DBTest from "./Views/DBTest";
import PlaySF from "./Views/PlaySF";
function App() {
  // const [greetMsg, setGreetMsg] = createSignal("");
  // const [name, setName] = createSignal("");

  // async function greet() {
  //   // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
  //   setGreetMsg(await invoke("greet", { name: name() }));
  // }



  return (
    <Router root={Layout}>
            <Route path="/" component={Home} />
            <Route path="/viewer" component={Viewer} />
            <Route path="/pgn" component={PgnView} />
            <Route path="/editor" component={Editor} />
            <Route path="/play" component={Play} />
            <Route path="/db" component={DBTest} />
            <Route path="/playsf" component={PlaySF} />

        </Router>
  );
}

export default App;
