import { Accessor, Component, createEffect, createSignal, For, JSX, Setter, Show } from 'solid-js';
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
    renderNode?: (node: TreeNode<T>) => JSX.Element;
    renderExpandedIndicator?: (expanded: boolean, node: TreeNode<T>) => JSX.Element;
    onSelectedChanged?: (node: TreeNode<T> | null) => void;
};

type TreeViewNodeProps<T> = {
    node: TreeNode<T>;
    onNodeClick?: (node: TreeNode<T>) => void;
    expandedNodes: Accessor<Set<string>>;
    setExpandedNodes: Setter<Set<string>>;
    selectedNode: Accessor<TreeNode<T> | null>;
    renderNode?: (node: TreeNode<T>) => JSX.Element;
    renderExpandedIndicator?: (expanded: boolean, node: TreeNode<T>) => JSX.Element;
    level: number;
};

const Node = <T,>(props: TreeViewNodeProps<T>): JSX.Element => {
    const { node, onNodeClick, expandedNodes, setExpandedNodes, renderNode, renderExpandedIndicator, selectedNode, level } = props;
    const [children, setChildren] = createSignal<TreeNode<T>[] | undefined>(node.children);



    const toggleNode = async (node: TreeNode<T>) => {
        const expanded = new Set(expandedNodes());
        if (expanded.has(node.id)) {
            expanded.delete(node.id);
        } else {
            expanded.add(node.id);
            if (node.loadChildren /* && !node.children */) {
                node.children = await node.loadChildren();
                setChildren(node.children);
            }
        }
        setExpandedNodes(expanded);
    };

    const handleNodeClick = () => {
        onNodeClick?.(node);
        toggleNode(node);
    };

    // const isSelected = () => {

    const isExpandable = () => node.children || node.loadChildren;

    const isExpanded = () => !!(isExpandable() && expandedNodes().has(node.id));

    const isSelected = () => {
        return selectedNode()?.id === node.id;
    }

    const classList = () => {

        const classes = {
            [styles.treeRow]: true,
            [styles.selected]: isSelected(),
            "selected": isSelected(),
        };
        return classes;
    }

    return (
        <>
            <div classList={classList()} onClick={handleNodeClick}>

                <div style={{ width: `${level * 20}px` }}></div>

                <Show when={isExpandable()}>
                    {renderExpandedIndicator?.(isExpanded(), node) || (isExpanded() ? "-" : "+")}
                </Show>

                <div class={styles.nodeContent}>
                    <Show when={renderNode} fallback={<span>{node.label}</span>}>
                        {renderNode!(node)}
                    </Show>
                </div>
            </div>
            <Show when={isExpanded() && children()!.length > 0}>
                <For each={node.children}>
                    {(child) => (
                        <Node node={child}
                            onNodeClick={onNodeClick}
                            expandedNodes={expandedNodes}
                            setExpandedNodes={setExpandedNodes}
                            renderNode={renderNode}
                            renderExpandedIndicator={renderExpandedIndicator}
                            selectedNode={selectedNode}
                            level={level + 1}
                        />
                    )}
                </For>
            </Show>
        </>
    );
}


const TreeView = <T,>(props: TreeViewProps<T>): JSX.Element => {
    const [expandedNodes, setExpandedNodes] = createSignal<Set<string>>(new Set());
    const [selectedNode, setSelectedNode] = createSignal<TreeNode<T> | null>(null);

    createEffect(() => {
        if (props.onSelectedChanged) {
            props.onSelectedChanged(selectedNode());
        }
    });

    const handleNodeClick = (node: TreeNode<T>) => {
        setSelectedNode(node);
        if (props.onNodeClick) {
            props.onNodeClick(node);
        }
    };

    return (
        <div class={styles.treeView}>
            <Node node={props.root}
                onNodeClick={handleNodeClick}
                expandedNodes={expandedNodes}
                setExpandedNodes={setExpandedNodes}
                renderNode={props.renderNode}
                renderExpandedIndicator={props.renderExpandedIndicator}
                selectedNode={selectedNode}
                level={0}
            />
        </div>
    );
};

export default TreeView;