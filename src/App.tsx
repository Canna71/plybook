import { createSignal } from "solid-js";
import logo from "./assets/logo.svg";
import { invoke } from "@tauri-apps/api/core";
import "./App.scss";
import { Chess } from "chessops";
import { Chessboard } from "./chessboard/chessboard";

function App() {
  const [greetMsg, setGreetMsg] = createSignal("");
  const [name, setName] = createSignal("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name: name() }));
  }

  return (
    <main class="container">
      <h1>♘ Welcome to Rechess ♘</h1>

      
      <Chessboard />

      
    </main>
  );
}

export default App;
