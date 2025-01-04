import {
    batch,
    createEffect,
    createSignal,
    useContext,
} from "solid-js";
import TreeView, { TreeNode } from "../common/TreeView";
import {
    listAppData,
    NameWithoutExtension,
} from "../../storage/fs";
import { IconChevronDown, IconChevronRight, IconFile } from "@tabler/icons-solidjs";
import { ContentContext } from "../common/ContentContext";
import FileBrowserItem from "./FileBrowserItem";
import { sep } from "@tauri-apps/api/path";

type FileBrowserProps = {
    rootFolder: FileBrowserFile;
    // fetchFiles: (path: string) => Promise<TreeNode<FileBrowserFile>[]>;
    onSelectedFileChanged?: (file: FileBrowserFile) => void;
    onNodeClick?: (node: FileBrowserFile) => void;
};

export interface FileBrowserFile {
    path: string;
    name: string;
    isDirectory: boolean;
    // isRenaming: Accessor<boolean>;
}

async function directoryToNodes(path: string) {
    const content = await listAppData(path);
    const ret = content
        .filter((de) => de.isFile || de.isDirectory)
        .filter((de) => !de.name.startsWith("."))
        .map((file) => {
            const fullPath = `${path}${sep()}${file.name}`;
            return {
                id: fullPath,
                label: file.isDirectory
                    ? file.name
                    : NameWithoutExtension(file.name),
                data: {
                    path: fullPath,
                    name: file.name,
                    isDirectory: file.isDirectory,
                },
                loadChildren: file.isDirectory
                    ? async () => directoryToNodes(fullPath)
                    : undefined,
            };
        });
    return ret;
}

const FileBrowser = (props: FileBrowserProps) => {
    const { refreshTrigger, renaming } = useContext(ContentContext)!;
    const [selectedNode, setSelectedNode] = createSignal<TreeNode<FileBrowserFile> | null>(null);
    const [expandedNodes, setExpandedNodes] = createSignal<Set<string>>(new Set());

    const root = {
        id: props.rootFolder.path,
        label: NameWithoutExtension(props.rootFolder.name),
        data: {
            path: props.rootFolder.path,
            name: props.rootFolder.name,
            isDirectory: props.rootFolder.isDirectory,
        },
        loadChildren: async () => directoryToNodes(props.rootFolder.path),
    };
    const [rootNode, setRootNode] =
        createSignal<TreeNode<FileBrowserFile>>(root);

    const onNodeClickInternal = (node: TreeNode<FileBrowserFile>) => {
        props.onNodeClick?.(node.data!);
    };

    // const onSelectedChangedInternal = (
    //     node: TreeNode<FileBrowserFile> | null,
    // ) => {
    //     props.onSelectedFileChanged?.(node?.data!);
    // };

    createEffect(() => {
        const trigger = refreshTrigger();
        console.log("refreshing file browser: ", trigger);
        batch(() => {
            setRootNode({
                ...root,
            });
        });
    });

    return (
        <TreeView
            selectedNodeSignal={[selectedNode, setSelectedNode]}
            expandedNodesSignal={[expandedNodes, setExpandedNodes]}
            indentSize={8}
            root={rootNode}
            
            onNodeClick={onNodeClickInternal}
            renderNode={(node, _isRenaming) => (
                <FileBrowserItem node={node} expandedNodesSignal={[expandedNodes, setExpandedNodes]} />
            )}
            renderItemIcon={(node) =>(
                node.data!.isDirectory ? null : <IconFile />
            )}
            renderExpandedIndicator={(isExpanded, _node) =>
                isExpanded ? <IconChevronDown /> : <IconChevronRight />
            }
            renaming={renaming}
        />
    );
};

export default FileBrowser;
