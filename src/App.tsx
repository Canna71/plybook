
import "./styles/App.scss";
import { Router, Route } from "@solidjs/router";
import Home from "./Views/Home";
import Layout from "./Views/Layout";
import Editor from "./Views/Editor";
import DBTest from "./Views/DBTest";
import PlaySF from "./Views/PlaySF";
import AnalysisView from "./Views/AnalysisView";
import GameView from "./Views/GameView";
import { getSettingValue } from "./models/settings";
import { createEffect } from "solid-js";
import { CSSLoader } from "./theming/CssLoader";
function App() {
  // const [greetMsg, setGreetMsg] = createSignal("");
  // const [name, setName] = createSignal("");

  // async function greet() {
  //   // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
  //   setGreetMsg(await invoke("greet", { name: name() }));
  // }

  const cssLoader = new CSSLoader();

  // dynamically load css in assets folder 
  createEffect(async () => {
    // TODOL load from resources folder
    const boardTheme = await getSettingValue("themes.board");
    console.log("boardTheme", boardTheme);
    cssLoader.unloadCSS("board-theme");
    cssLoader.loadCSS(`/src/assets/styles/boards/${boardTheme}.css`, { id: "board-theme" });
    const piecesTheme = await getSettingValue("themes.pieces");
    cssLoader.unloadCSS("pieces-theme");
    cssLoader.loadCSS(`/src/assets/styles/pieces/${piecesTheme}/pieces.css`, { id: "pieces-theme" });
  });


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
