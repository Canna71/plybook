import { MenuItemOptions } from "@tauri-apps/api/menu";
import { Component, useContext } from "solid-js";
import { ContentContext } from "../common/ContentContext";
import { TreeNode } from "../common/TreeView";
import { FileBrowserFile } from "./FileBrowser";
import { createNewDataFile, createNewDataFolder, deleteDataFileOrFolder } from "../../storage/fs";
import { useContextMenu } from "../common/contextmenu";

type FileBrowserItemProps = {
    node: TreeNode<FileBrowserFile>;
};

const FileBrowserItem : Component<FileBrowserItemProps> = ({node}) => {
    const contentContext = useContext(ContentContext);


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
        <span onContextMenu={(e) => onContextMenuInternal(e, node)}>
            {node.label}
        </span>
    );
}

export default FileBrowserItem;
