import { MenuItemOptions } from "@tauri-apps/api/menu";
import {
    batch,
    Component,
    Show,
    Signal,
    useContext,
} from "solid-js";
import { ContentContext } from "../common/ContentContext";
import { TreeNode } from "../common/TreeView";
import { FileBrowserFile } from "./FileBrowser";
import {
    createNewDataFolder,
    deleteDataFileOrFolder,
    openDataPath,
    renameOrCreateDataFile,
} from "../../storage/fs";
import { useContextMenu } from "../common/contextmenu";
import Editable from "../common/Editable";
import anylogger from "anylogger";
const log = anylogger("filebrowser");

type FileBrowserItemProps = {
    node: TreeNode<FileBrowserFile>;
    expandedNodesSignal: Signal<Set<string>>;
};

const FileBrowserItem: Component<FileBrowserItemProps> = ({ node, expandedNodesSignal }) => {
    const { renaming, setRenaming, refresh } = useContext(ContentContext)!;
    const [expandedNodes, setExpandedNodes] = expandedNodesSignal;


    const onNewFolder = async (_id: string, node: TreeNode<FileBrowserFile>) => {
        const newPath = await createNewDataFolder(node.data!.path, "Untitled");
        batch(() => {
            setExpandedNodes(new Set(expandedNodes()).add(node.id));
            setRenaming(newPath);
            refresh();
        });
    };

    const onDeleteStudy = async (
        _id: string,
        node: TreeNode<FileBrowserFile>,
    ) => {
        await deleteDataFileOrFolder(node.data!.path);
        refresh();
    };

    const onDeleteFolder = async (
        node: TreeNode<FileBrowserFile>,
        _id: string,
    ) => {
        await deleteDataFileOrFolder(node.data!.path);
        refresh();
    };

    const onRenameFolder = (node: TreeNode<FileBrowserFile>, _id: string) => {
        setRenaming(node.id);
    };

    const onRenameStudy = (node: TreeNode<FileBrowserFile>, _id: string) => {
        setRenaming(node.id);
    };

    const onRename = async (value: string) => {
        await renameOrCreateDataFile(node.data!.path, value);
        batch(() => {
            setRenaming(undefined);
            refresh();
        });
    };

    const onOpenInDesktop = async  (node: TreeNode<FileBrowserFile>) => {
        try {
            await openDataPath(node.data!.path);
        } catch (e) {
            log.error(e);
        }
    }
    

    const onContextMenuInternal = (
        e: MouseEvent,
        node: TreeNode<FileBrowserFile>,
    ) => {
        e.preventDefault();
        const menuItems: MenuItemOptions[] = [];
        if (!node.data || node.data.isDirectory) {
            // menuItems.push({
            //     id: "file_new",
            //     text: "New Study",
            //     action: (id: string) => onNewStudy(id, node),
            // });
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
            menuItems.push({
                id: "folder_refresh",
                text: "Refresh",
                action: () => refresh(),
            });
            menuItems.push({
                id: "open_in_desktop",
                text: "Open in Desktop",
                action: () => onOpenInDesktop(node),
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

    const isRenaming = () => renaming() === node.id;

    return (
        <>
            <Show when={!isRenaming()}>
                <div class="file-browser-item-content">
                <span onContextMenu={(e) => onContextMenuInternal(e, node)}>
                    {node.label}
                </span>
                </div>
            </Show>
            <Show when={isRenaming()}>
                <Editable
                    initialValue={node.label}
                    editable={() => true}
                    onSave={onRename}
                    focus={true}
                />
            </Show>
        </>
    );
};

export default FileBrowserItem;

