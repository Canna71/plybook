import { createSignal } from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";
import BoardEditor from "../components/boardeditor/BoardEditor";
import Button from "../components/common/Button";
import PageHeader from "../components/shell/PageHeader";
import "./BoardEditorView.scss";

const BoardEditorView = () => {
    // ?fen= starts from a given position (from the PDF reader, say)
    const [params] = useSearchParams();
    const navigate = useNavigate();
    const [fen, setFen] = createSignal<string | undefined>(
        typeof params.fen === "string"
            ? params.fen
            : "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
    const open = (route: string) => {
        const current = fen();
        if (current) navigate(`${route}?fen=${encodeURIComponent(current)}`);
    };

    return (
        <div class="board-editor-view">
            <PageHeader
                title="Board editor"
                description="Set up any position, then analyse it, play it out against the engine, or look it up in your databases."
            />
            <div class="board-editor-view-body">
                <BoardEditor fen={fen} setFen={setFen}>
                    <Button
                        class="is-primary"
                        onClick={() => open("/analysis")}
                    >
                        Analyze
                    </Button>
                    <Button onClick={() => open("/play")}>
                        Play from here
                    </Button>
                    <Button onClick={() => open("/databases")}>
                        Find in databases
                    </Button>
                </BoardEditor>
            </div>
        </div>
    );
};

export default BoardEditorView;
