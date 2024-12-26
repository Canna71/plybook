import { Accessor, Component, createSignal, For, JSX, Setter, Show } from 'solid-js';
import styles from './TreeView.module.scss'; // Create and import your custom styles

export type TreeNode<T> = {
    id: string;
    label: string;
    children?: TreeNode<T>[];
    data?: T;
    loadChildren?: () => Promise<TreeNode<T>[]>;
};


type TreeViewProps<T> = {
    root: TreeNode<T>;
    onNodeClick?: (node: TreeNode<T>) => void;
};

type TreeViewNodeProps<T> = {
    node: TreeNode<T>;
    onNodeClick: (node: TreeNode<T>) => void;
    expandedNodes: Accessor<Set<string>>;
    setExpandedNodes: Setter<Set<string>>;
};

const Node = <T,>(props: TreeViewNodeProps<T>): JSX.Element => {
    const { node, onNodeClick, expandedNodes, setExpandedNodes } = props;
    const [children, setChildren] = createSignal<TreeNode<T>[] | undefined>(node.children);



    const toggleNode = async (node: TreeNode<T>) => {
        const expanded = new Set(expandedNodes());
        if (expanded.has(node.id)) {
            expanded.delete(node.id);
        } else {
            expanded.add(node.id);
            if (node.loadChildren && !node.children) {
                node.children = await node.loadChildren();
                setChildren(node.children);
            }
        }
        setExpandedNodes(expanded);
    };

    const handleNodeClick = () => {
        onNodeClick(node);
        toggleNode(node);
    };

    const isExpandable = () => node.children || node.loadChildren;

    const isExpanded = () => isExpandable() && expandedNodes().has(node.id);

    return (
        <li>
            <div class={styles.node} onClick={handleNodeClick}>
                <Show when={isExpandable()}>
                    <span>
                        {expandedNodes().has(node.id) ? '-' : '+'}
                    </span>
                </Show>
                <span >
                    {node.label}
                </span>
            </div>
            <Show when={isExpanded() && children()!.length > 0}>
                <ul>
                    <For each={node.children}>
                        {(child) => (
                            <Node node={child}
                                onNodeClick={onNodeClick}
                                expandedNodes={expandedNodes}
                                setExpandedNodes={setExpandedNodes}
                            />
                        )}
                    </For>
                </ul>
            </Show>
        </li>
    );
}


const TreeView = <T,>(props: TreeViewProps<T>): JSX.Element => {
    const [expandedNodes, setExpandedNodes] = createSignal<Set<string>>(new Set());


    const handleNodeClick = (node: TreeNode<T>) => {
        if (props.onNodeClick) {
            props.onNodeClick(node);
        }
    };

    return (
        <div class={styles.treeView}>
            <ul>
                <Node node={props.root}
                    onNodeClick={handleNodeClick}
                    expandedNodes={expandedNodes}
                    setExpandedNodes={setExpandedNodes}
                />
            </ul>
        </div>
    );
};

export default TreeView;