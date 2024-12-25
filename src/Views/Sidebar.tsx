
const Sidebar = () => {

    return (
        <aside class="menu-list">
            <ul>
                <li><a href="/">Home</a></li>
                <li><a href="/viewer">Board Viewer</a></li>
                <li><a href="/editor">Board Editor</a></li>
                <li><a href="/pgn">Pgn View</a></li>
                <li><a href="/pgnedit">Pgn Edit</a></li>
                <li><a href="/playsf">Play</a></li>
                <li><a href="/analysis">Analysis</a></li>
                <li><a href="/db">DB Test</a></li>
            </ul>

        </aside>
    );
}

export default Sidebar;