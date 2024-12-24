
import { createSignal } from "solid-js";
import BoardEditor from "../components/boardeditor/BoardEditor";

const Editor = () => {

    const [fen, setFen] = createSignal<string | undefined>(undefined);

    return (
        <div>
            <div>
                <BoardEditor fen={fen} setFen={setFen}  />
                
            </div>
        </div>
    );
}

export default Editor;