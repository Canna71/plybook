import { createSignal } from "solid-js";
import BoardEditor from "../components/boardeditor/BoardEditor";
import "./BoardEditorView.scss";

const BoardEditorView = () => {

    const [fen, setFen] = createSignal<string | undefined>(undefined);

    return (
        
            <div class="board-editor-view">
                <BoardEditor fen={fen} setFen={setFen}  />
                <div class="board-editor-spacer">&nbsp;</div>
            </div>
        
    );
}

export default BoardEditorView;