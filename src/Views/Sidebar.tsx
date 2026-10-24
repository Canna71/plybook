import FileBrowser, {
    FileBrowserFile,
} from "../components/sidebar/FileBrowser";
import { useNavigate } from "@solidjs/router";

const Sidebar = () => {
    // const [selectedFile, setSelectedFile] = createSignal<FileBrowserFile | undefined>(undefined);

    const navigate = useNavigate();

    const onNodeClick = (file: FileBrowserFile) => {
        if (file && !file.isDirectory) {
            if (file.name.endsWith(".pgn")) {
                navigate(
                    `/game?path=${encodeURIComponent(file.path)}&source=library`,
                );
            }
        }
        if (file && file.isDirectory) {
            navigate(`/library?path=${encodeURIComponent(file.path)}`);
        }
    };

    return (
        <>
            <aside class="menu">
                <ul class="menu-list">
                    <li>
                        <a href="/">Home</a>
                    </li>
                    {/* <li><a href="/boardeditor">Board Editor</a></li> */}
                    {/* <li><a href="/game">Pgn Edit</a></li> */}
                    <li>
                        <a href="/play">Play Engine</a>
                    </li>
                    <li>
                        <a href="/puzzles">Puzzles</a>
                    </li>
                    <li>
                        <a href="/repertoires">Repertoires</a>
                    </li>
                    <li>
                        <a href="/history">History</a>
                    </li>
                    {/* <li><a href="/puzzle?path=/Users/gcannata/Library/Application Support/rechess/Library/pgn/Four Pieces.pgn">Puzzle</a></li> */}
                    {/* <li><a href="/analysis">Analysis</a></li> */}
                    <li>
                        <a href="/databases">Databases</a>
                    </li>
                    <li>
                        <a href="/scan">Scan position</a>
                    </li>
                    <li>
                        <a href="/settings">Settings</a>
                    </li>
                </ul>
                <p class="menu-label">Library</p>
                <ul class="menu-list"></ul>
            </aside>

            <aside>
                <FileBrowser
                    onNodeClick={onNodeClick}
                    rootFolder={{
                        path: `Library`,
                        name: "Library",
                        isDirectory: true,
                    }}
                ></FileBrowser>
            </aside>
        </>
    );
};

export default Sidebar;
