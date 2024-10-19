import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import "./App.scss";
import BoardEditor from "./chessboard/BoardEditor";

function App() {
  const [greetMsg, setGreetMsg] = createSignal("");
  const [name, setName] = createSignal("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name: name() }));
  }

  const config = {
    fen: "r1bk3r/p2pBpNp/n4n2/1p1NP2P/6P1/3P4/P1P1K3/q5b1"
  }

  return (
    <main class="container">
      <h1>♘ Welcome to Rechess ♘</h1>

    <div style="max-width: 600px">
      <BoardEditor  />

    </div>
      

      
    </main>
  );
}

export default App;
