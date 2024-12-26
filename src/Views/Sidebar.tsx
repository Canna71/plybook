import { createSignal, Show } from "solid-js";
import TreeView, { TreeNode } from "../components/common/TreeView";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-solidjs";

const Sidebar = () => {
    const [selectedNode, setSelectedNode] = createSignal<TreeNode<any> | null>(null);

    const treeData: TreeNode<any> = {
        id: 'root',
        label: 'Root',
        children: [
            {
                id: 'child1',
                label: 'Child 1',
                loadChildren: async () => {
                    return [
                        { id: 'child1-1', label: 'Child 1.1' },
                        { id: 'child1-2', label: 'Child 1.2' },
                    ];
                }
            },
            { id: 'child2', label: 'Empty Child 2', loadChildren: async () => [] },
            {
                id: 'child3',
                label: 'Child 3'
            },
        ],
    };
    return (
        <>
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
                
            </ul>
        </aside>
        <aside>
            <TreeView root={treeData} 
                    onSelectedChanged={setSelectedNode}
                    renderNode={(node) => <span>{node.label}</span>}
                    renderExpandedIndicator={
                        (isExpanded, node) => isExpanded ? <IconChevronDown /> : <IconChevronRight />
                    }   
                />
                <Show when={selectedNode()}>
                    <p class="menu-label">
                        Selected Node: {selectedNode()?.label}
                    </p>
                </Show>
        </aside>
        </>
    );
}

export default Sidebar;