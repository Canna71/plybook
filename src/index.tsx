/* @refresh reload */
import { render } from "solid-js/web";
import { Route, Router } from "@solidjs/router";
import Home from "./Views/Home";
import Layout from "./Views/Layout";
import "./App.scss";
import Viewer from "./Views/Viewer";
import PgnView from "./Views/PgnView";
import Editor from "./Views/Editor";

render(
    () => (
        <Router root={Layout}>
            <Route path="/" component={Home} />
            <Route path="/viewer" component={Viewer} />
            <Route path="/pgn" component={PgnView} />
            <Route path="/editor" component={Editor} />
        </Router>
    ), 

document.getElementById("root") as HTMLElement);


