import { batch, createEffect, createSignal, useContext } from "solid-js";
import TreeView, { TreeNode } from "../common/TreeView";
import {
    createNewDataFile,
    createNewDataFolder,
    deleteDataFileOrFolder,
    listAppData,
    NameWithoutExtension,
} from "../../storage/fs";
import { IconChevronDown, IconChevronRight } from "@tabler/icons-solidjs";
import { useContextMenu } from "../common/contextmenu";
import { MenuItemOptions } from "@tauri-apps/api/menu";
import { ContentContext } from "../common/ContentContext";

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
}

async function directoryToNodes(path: string) {
    const content = await listAppData(path);
    const ret = content
        .filter((de) => de.isFile || de.isDirectory)
        .filter((de) => !de.name.startsWith("."))
        .map((file) => {
            const fullPath = `${path}/${file.name}`;
            return {
                id: fullPath,
                label: file.isDirectory ? file.name : NameWithoutExtension(file.name),
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
    const contentContext = useContext(ContentContext);
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
    const [rootNode, setRootNode] = createSignal<TreeNode<FileBrowserFile>>(root);

    const onNewStudy = async (id: string, node: TreeNode<FileBrowserFile>) => {
        const newPath = await createNewDataFile(
            node.data!.path,
            "Untitled.pgn",
            "[]",
        );
        contentContext?.refresh();
    };

    const onNewFolder = async (id: string, node: TreeNode<FileBrowserFile>) => {
        const newPath = await createNewDataFolder(
            node.data!.path,
            "Untitled"
        );
        contentContext?.refresh();
    };

    const onDeleteStudy = async (
        id: string,
        node: TreeNode<FileBrowserFile>,
    ) => {
        await deleteDataFileOrFolder(node.data!.path);
        contentContext?.refresh();
    };

    const onDeleteFolder = async (node: TreeNode<FileBrowserFile>, id: string) => {
        await deleteDataFileOrFolder(node.data!.path);
        contentContext?.refresh();
    };

    const onRenameFolder = (node: TreeNode<FileBrowserFile>, id: string) => {
        console.log("rename folder: ", node);
    };

    const onRenameStudy = (node: TreeNode<FileBrowserFile>, id: string) => {
        console.log("rename study: ", node);
    };

    createEffect(() => {
        const trigger = contentContext?.refreshTrigger();
        console.log("refreshing file browser: ", trigger);
        batch(() => {
            setRootNode({
                ...root,
            });
        });
    });

    const onContextMenuInternal = (
        e: MouseEvent,
        node: TreeNode<FileBrowserFile>,
    ) => {
        e.preventDefault();
        const menuItems: MenuItemOptions[] = [];
        if (!node.data || node.data.isDirectory) {
            menuItems.push({
                id: "file_new",
                text: "New Study",
                action: (id: string) => onNewStudy(id, node),
            });
            menuItems.push({
                id: "folder_new",
                text: "New Folder",
                action: (id: string) => onNewFolder(id, node),
            });
            menuItems.push({
                id: "folder_delete",
                text: "Delete Folder",
                action: (id: string) => onDeleteFolder(node, id),
            });
            menuItems.push({
                id: "folder_rename",
                text: "Rename Folder",
                action: (id: string) => onRenameFolder(node, id),
            });
        } else {
            menuItems.push({
                id: "file_delete",
                text: "Delete Study",
                action: (id: string) => onDeleteStudy(id, node),
            });
            menuItems.push({
                id: "file_rename",
                text: "Rename Study",
                action: (id: string) => onRenameStudy(node, id),
            });
        }
        const onContextMenu = useContextMenu({
            items: menuItems,
        });
        onContextMenu(e);
    };

    return (
        <TreeView
            indentSize={8}
            root={rootNode}
            onSelectedChanged={(node) =>
                props.onSelectedFileChanged?.(node?.data!)
            }
            onNodeClick={(node) => props.onNodeClick?.(node.data!)}
            renderNode={(node) => (
                <span onContextMenu={(e) => onContextMenuInternal(e, node)}>
                    {node.label}
                </span>
            )}
            renderExpandedIndicator={(isExpanded, _node) =>
                isExpanded ? <IconChevronDown /> : <IconChevronRight />
            }
        />
    );
};

export default FileBrowser;
