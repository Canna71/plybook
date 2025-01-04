import {
    batch,
    Component,
    createSignal,
    Match,
    onMount,
    Signal,
    Switch,
} from "solid-js";
import showdown from "showdown";

type MarkdownEditorProps = {
    valueSignal: Signal<string>;
};

const MarkdownEditor: Component<MarkdownEditorProps> = (props) => {
    const [value, setValue] = props.valueSignal;
    const [isEditing, setIsEditing] = createSignal(false);
    let div: HTMLDivElement | null = null;
    let textarea: HTMLDivElement | null = null;

    onMount(() => {
        console.log("onMount", textarea);
        // textarea!.style.height = "";
        // textarea!.style.height = textarea!.scrollHeight + "px"
    });

    const onInput = (e: InputEvent) => {};

    const onBlur = () => {
        let value = textarea!.innerText;
        batch(() => {
            setValue(value);
            setIsEditing(false);
        });
    };

    const html = () => {
        const converter = new showdown.Converter();
        return converter.makeHtml(value()) as string;
    };

    return (
        <Switch>
            <Match when={isEditing()}>
                <div
                    class="markdown-text"
                    ref={textarea!}
                    innerText={value()}
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
