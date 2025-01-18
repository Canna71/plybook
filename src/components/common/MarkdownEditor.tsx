import {
    batch,
    Component,
    Match,
    onMount,
    Signal,
    Switch,
    useContext,
} from "solid-js";
import showdown from "showdown";
import { GameContext } from "../game/GameContext";
import { initFromGameModel } from "./utils";

const SEPARATOR = "§§§";

type MarkdownEditorProps = {
    valueSignal: Signal<string>;
    isEditingSignal: Signal<boolean>;
};

// function convertNewLines(text: string) {

// }

const MarkdownEditor: Component<MarkdownEditorProps> = (props) => {
    const [value, setValue] = props.valueSignal;
    const [isEditing, setIsEditing] = props.isEditingSignal;
    // let div: HTMLDivElement | null = null;
    let textarea: HTMLDivElement | null = null;
    const gameContext = useContext(GameContext)!;
    const { gameSignal:[game] } = gameContext;

    onMount(() => {
        // textarea!.style.height = "";
        // textarea!.style.height = textarea!.scrollHeight + "px"
    });

    const onInput = (_e: InputEvent) => {};

    const cleanText = () => {
        let text = value();
        text = text.replaceAll(SEPARATOR, "\n");
        return text;
    }

    const encodeText = (text: string) => {
        text = text.replace(/\r\n/g, SEPARATOR);
        text = text.replace(/\n/g, SEPARATOR);
        return text;
    }

    const onBlur = () => {
        let value = textarea!.innerText;
        value = encodeText(value);
        
        
        const newGame = game()?.updateHeaders(
            new Map([
                ["Description", value || ""],
            ]),
        );

        batch(() => {
            initFromGameModel(gameContext, newGame!);
            setValue(value);
            setIsEditing(false);
        });
    };

    const html = () => {
        const converter = new showdown.Converter();
        let val = value();
        if (!val) {
            return "";
        }
        val = val.replaceAll(SEPARATOR, "\n");
        return converter.makeHtml(val) as string;
    };

    return (
        <Switch>
            <Match when={isEditing()}>
                <div
                    class="markdown-text"
                    ref={textarea!}
                    innerText={cleanText()}
                    contentEditable={true}
                    onInput={onInput}
                    onBlur={onBlur}
                />
                {/* <button onClick={() => setIsEditing(false)}>Edit</button> */}
            </Match>
            <Match when={!isEditing()}>
                <div
                    onClick={() => setIsEditing(true)}
                    class="content"
                    innerHTML={html()}
                ></div>
            </Match>
        </Switch>
    );
};
export default MarkdownEditor;
