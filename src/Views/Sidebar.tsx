import { createSignal, Show } from "solid-js";
import TreeView, { TreeNode } from "../components/common/TreeView";

const Sidebar = () => {
    const [selectedNode, setSelectedNode] = createSignal<TreeNode<any> | null>(null);

    const handleNodeClick = (node: TreeNode<any>) => {
        setSelectedNode(node);
        console.log('Node clicked:', node);
    };
    const treeData: TreeNode<any> = {
        id: 'root',
        label: 'Root',
        children: [
            {
                id: 'child1',
                label: 'Child 1',
                children: [
                    { id: 'child1-1', label: 'Child 1.1' },
                    { id: 'child1-2', label: 'Child 1.2' },
                ],
            },
            { id: 'child2', label: 'Child 2' },
        ],
    };
    return (
        <aside class="menu">
            <p class="menu-label">Dev Pages</p>
            <ul class="menu-list">
                <li><a href="/">Home</a></li>
                <li><a href="/viewer">Board Viewer</a></li>
                <li><a href="/editor">Board Editor</a></li>
                <li><a href="/pgn">Pgn View</a></li>
                <li><a href="/pgnedit">Pgn Edit</a></li>
                <li><a href="/playsf">Play</a></li>
                <li><a href="/analysis">Analysis</a></li>
                <li><a href="/db">DB Test</a></li>
            </ul>
            <p class="menu-label">Library</p>
            <ul class="menu-list">
                <TreeView root={treeData} onNodeClick={handleNodeClick} />
                <Show when={selectedNode()}>
                    <p class="menu-label">
                        Selected Node: {selectedNode()?.label}
                    </p>
                </Show>
            </ul>
        </aside>
    );
}

export default Sidebar;