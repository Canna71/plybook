import {
    Accessor,
    batch,
    createEffect,
    createSignal,
    For,
    Index,
    JSX,
    Setter,
    Show,
    Signal,
} from "solid-js";
import styles from "./TreeView.module.scss"; // Create and import your custom styles

export type TreeNode<T> = {
    id: string;
    label: string;
    children?: TreeNode<T>[];
    data?: T;
    loadChildren?: () => Promise<TreeNode<T>[]>;
};

type TreeViewProps<T> = {
    root: Accessor<TreeNode<T>>;
    onNodeClick?: (node: TreeNode<T>) => void;
    renderNode?: (node: TreeNode<T>, isRenamimg: boolean) => JSX.Element;
    renderExpandedIndicator?: (
        expanded: boolean,
        node: TreeNode<T>,
    ) => JSX.Element;
    renderItemIcon?: (node: TreeNode<T>) => JSX.Element;
    onSelectedChanged?: (node: TreeNode<T> | null) => void;
    indentSize?: number;
    renaming?: Accessor<string | undefined>;
    selectedNodeSignal: Signal<TreeNode<T> | null>;
    expandedNodesSignal: Signal<Set<string>>; 
};

type TreeViewNodeProps<T> = {
    node: Accessor<TreeNode<T>>;
    onNodeClick?: (node: TreeNode<T>) => void;
    expandedNodesSignal: Signal<Set<string>>;
    selectedNode: Accessor<TreeNode<T> | null>;
    renderNode?: (node: TreeNode<T>, isRenaming: boolean) => JSX.Element;
    renderExpandedIndicator?: (
        expanded: boolean,
        node: TreeNode<T>,
    ) => JSX.Element;
    renderItemIcon?: (node: TreeNode<T>) => JSX.Element;
    level: number;
    indentSize: number;
    renaming?: Accessor<string | undefined>;

};

const Node = <T,>(props: TreeViewNodeProps<T>): JSX.Element => {
    const {
        node,
        onNodeClick,
        expandedNodesSignal,
        renderNode,
        renderExpandedIndicator,
        selectedNode,
        level,
        renaming
    } = props;
    const [children, setChildren] = createSignal<TreeNode<T>[] | undefined>(
        node().children,
    );
    const [expandedNodes, setExpandedNodes] = expandedNodesSignal;
    
    const refreshNode = async () => {
        if (node().loadChildren) {
            node().children = await node().loadChildren?.();
            // setTimeout(() => setChildren(node.children), 0);
            setChildren(node().children);
        }
    };

    createEffect(() => {
        if (expandedNodes().has(node().id)) {
            refreshNode();
        }
    });

    const toggleNode = async () => {
        const expanded = new Set(expandedNodes());
        if (expanded.has(node().id)) {
            expanded.delete(node().id);
        } else {
            expanded.add(node().id);
            await refreshNode();
        }
        setExpandedNodes(expanded);
    };

    const handleNodeClick = (e: MouseEvent) => {
        if(isRenaming()) {
            e.preventDefault();
            return;
        }
        batch(() => {
            onNodeClick?.(node());
            toggleNode();
        });
    };

    // const isSelected = () => {

    const isExpandable = () => node().children || node().loadChildren;

    const isExpanded = () => !!(isExpandable() && expandedNodes().has(node().id));

    const isSelected = () => {
        return selectedNode()?.id === node().id;
    };

    const isRenaming = () => { 
        return renaming?.() === node().id;
    }

    const classList = () => {
        const classes = {
            [styles.treeRow]: true,
            [styles.selected]: isSelected(),
            selected: isSelected(),
        };
        return classes;
    };

    return (
        <>
            <div classList={classList()} onClick={handleNodeClick}>
                <div style={{ width: `${level * (props.indentSize??20)}px` }}></div>

                <Show when={isExpandable()}>
                    {renderExpandedIndicator?.(isExpanded(), node()) ||
                        (isExpanded() ? "-" : "+")}
                </Show>
                <Show when={props.renderItemIcon}>
                    {props.renderItemIcon!(node())}
                </Show>
                <div class={styles.nodeContent}>
                    <Show
                        when={renderNode}
                        fallback={<span>{node().label}</span>}
                    >
                        {renderNode!(node(), isRenaming())}
                    </Show>
                </div>
            </div>
            <Show when={isExpanded() && children() && children()!.length > 0}>
                <Index each={children()}>
                    {(child) => (
                        <Node
                            indentSize={props.indentSize??20}
                            node={child}
                            onNodeClick={onNodeClick}
                            expandedNodesSignal={expandedNodesSignal}
                            renderNode={renderNode}
                            renderItemIcon={props.renderItemIcon}
                            renderExpandedIndicator={renderExpandedIndicator}
                            selectedNode={selectedNode}
                            level={level + 1}
                            renaming={renaming}
                        />
                    )}
                </Index>
            </Show>
        </>
    );
};

const TreeView = <T,>(props: TreeViewProps<T>): JSX.Element => {
    const [expandedNodes, setExpandedNodes] = props.expandedNodesSignal;
    const [selectedNode, setSelectedNode] = props.selectedNodeSignal;
    

    const handleNodeClick = (node: TreeNode<T>) => {
        setSelectedNode(node);
        if (props.onNodeClick) {
            props.onNodeClick(node);
        }
    };

    return (
        <div class={styles.treeView}>
            <Node
                indentSize={props.indentSize??20}
                node={props.root}
                onNodeClick={handleNodeClick}
                expandedNodesSignal={props.expandedNodesSignal}
                renderNode={props.renderNode}
                renderItemIcon={props.renderItemIcon}
                renderExpandedIndicator={props.renderExpandedIndicator}
                selectedNode={selectedNode}
                level={0}
                renaming={props.renaming || (()=>undefined)}
            />
        </div>
    );
};

export default TreeView;
