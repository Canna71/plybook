import { For, Show } from 'solid-js';
import styles from './TreeView.module.scss'; // Create and import your custom styles

export type TreeNode<T> = {
    id: string;
    label: string;
    children?: TreeNode<T>[];
    data?: T;
};


type TreeViewProps<T> = {
    root: TreeNode<T>;
    onNodeClick?: (node: TreeNode<T>) => void;
};

const TreeView = <T,>(props: TreeViewProps<T>) => {
    const handleNodeClick = (node: TreeNode<T>) => {
        if (props.onNodeClick) {
            props.onNodeClick(node);
        }
    };

    const renderNode = (node: TreeNode<T>) => (
        <li>
            <div class={styles.node} onClick={() => handleNodeClick(node)}>
                {node.label}
            </div>
            <Show when={node.children && node.children.length > 0}>
                <ul>
                    <For each={node.children}>
                        {(child) => renderNode(child)}
                    </For>
                </ul>
            </Show>
        </li>
    );

    return (
        <div class={styles.treeView}>
            <ul>
                {renderNode(props.root)}
            </ul>
        </div>
    );
};

export default TreeView;