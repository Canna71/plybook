import FileBrowser, { FileBrowserFile } from "../components/sidebar/FileBrowser";
import { useNavigate } from "@solidjs/router";

const Sidebar = () => {
    // const [selectedFile, setSelectedFile] = createSignal<FileBrowserFile | undefined>(undefined);

    const navigate = useNavigate();

    const onSelectedFileChanged = (file: FileBrowserFile) => {
        if(file && !file.isDirectory) {
            if(file.name.endsWith('.pgn')) {
                navigate(`/game?path=${file.path}&source=library`);
            }
        }
    }
    

    return (
        <>
            <aside class="menu">
                <p class="menu-label">Dev Pages</p>
                <ul class="menu-list">
                    <li><a href="/">Home</a></li>
                    <li><a href="/boardeditor">Board Editor</a></li>
                    <li><a href="/game">Pgn Edit</a></li>
                    <li><a href="/play">Play</a></li>
                    <li><a href="/analysis">Analysis</a></li>
                    <li><a href="/db">DB Test</a></li>
                </ul>
                <p class="menu-label">Library</p>
                <ul class="menu-list">

                </ul>
            </aside>

            <aside>
                <FileBrowser
                    onSelectedFileChanged={onSelectedFileChanged}
                    rootFolder={{
                        path: `Library`,
                        name: 'Library',
                        isDirectory: true,
                    }}
                >
                </FileBrowser>

            </aside>
        </>
    );
}

export default Sidebar;