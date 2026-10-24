import { createSignal } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import BoardEditor from "../components/boardeditor/BoardEditor";
import "./BoardEditorView.scss";

const BoardEditorView = () => {
    // ?fen= starts from a given position (from the PDF reader, say)
    const [params] = useSearchParams();
    const [fen, setFen] = createSignal<string | undefined>(
        typeof params.fen === "string" ? params.fen : undefined,
    );

    return (
        <div class="board-editor-view">
            <BoardEditor fen={fen} setFen={setFen} />
            <div class="board-editor-spacer">&nbsp;</div>
        </div>
    );
};

export default BoardEditorView;
