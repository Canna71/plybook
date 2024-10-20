import { createSignal } from "solid-js";
import { invoke } from "@tauri-apps/api/core";
import "./App.scss";

function App() {
  const [greetMsg, setGreetMsg] = createSignal("");
  const [name, setName] = createSignal("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name: name() }));
  }



  return (
    <div></div>
  );
}

export default App;
