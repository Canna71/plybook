
import "./styles/App.scss";
import { Router, Route } from "@solidjs/router";
import Home from "./Views/Home";
import Layout from "./Views/Layout";
import Editor from "./Views/Editor";
import DBTest from "./Views/DBTest";
import PlaySF from "./Views/PlaySF";
import AnalysisView from "./Views/AnalysisView";
import GameView from "./Views/GameView";
function App() {
  // const [greetMsg, setGreetMsg] = createSignal("");
  // const [name, setName] = createSignal("");

  // async function greet() {
  //   // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
  //   setGreetMsg(await invoke("greet", { name: name() }));
  // }

  // dynamically load css in assets folder 
  const piecescss = import("/src/assets/styles/pieces/smart/smart.css");
  const boardcss = import("/src/assets/styles/boards/bluish.css");

  return (
    <Router root={Layout}>
            <Route path="/" component={Home} />
            <Route path="/game" component={GameView} />
            <Route path="/boardeditor" component={Editor} />
            <Route path="/db" component={DBTest} />
            <Route path="/playsf" component={PlaySF} />
            <Route path="/analysis" component={AnalysisView} />

        </Router>
  );
}

export default App;
