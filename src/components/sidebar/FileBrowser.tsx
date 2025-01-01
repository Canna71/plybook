import { createSignal } from 'solid-js';
import TreeView, { TreeNode } from '../common/TreeView';
import { createNewDataFile, listAppData, NameWithoutExtension } from '../../storage/fs';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-solidjs';
import { useContextMenu } from '../common/contextmenu';
import { MenuItemOptions } from '@tauri-apps/api/menu';


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
        .filter(de => de.isFile || de.isDirectory)
        .filter(de => !de.name.startsWith('.'))
        .map((file) => {
        const fullPath = `${path}/${file.name}`;
        return {
            id: fullPath,
            label: NameWithoutExtension(file.name),
            data: {
                path: fullPath,
                name: file.name,
                isDirectory: file.isDirectory,
            },
            loadChildren: file.isDirectory ? (async () => directoryToNodes(fullPath)) : undefined,
        };
    });
    return ret;
}

const FileBrowser = (props: FileBrowserProps) => {
    const [rootNode, _setRootNode] = createSignal<TreeNode<FileBrowserFile>>({
        id: props.rootFolder.path,
        label: NameWithoutExtension(props.rootFolder.name),
        loadChildren: async () => directoryToNodes(props.rootFolder.path),
    });

    const onNewStudy = async (id:string, node: TreeNode<FileBrowserFile>, refresh:()=>void) => {
        console.log('new study: ', node);
        const newPath = await createNewDataFile(node.data!.path, 'New Study.pgn',"[]");
        refresh();
    } ;

    const onDeleteStudy = (node: TreeNode<FileBrowserFile>, id:string) => {
        console.log('delete study: ', node);
    } ;
    
    const onDeleteFolder = (node: TreeNode<FileBrowserFile>, id:string) => {
        console.log('delete folder: ', node);
    } ;

    const onRenameFolder = (node: TreeNode<FileBrowserFile>, id:string) => {
        console.log('rename folder: ', node);
    } ;
    
    const onRenameStudy = (node: TreeNode<FileBrowserFile>, id:string) => {
        console.log('rename study: ', node);
    } ;

    const onContextMenuInternal = (e: MouseEvent,node: TreeNode<FileBrowserFile>, refresh:()=>void) => {
        e.preventDefault();
        const menuItems: MenuItemOptions[] = [];
        if(node.data?.isDirectory) {
            menuItems.push({ id: "file_new", text: "New Study", action: (id:string)=>onNewStudy(id,node,refresh) });
            menuItems.push({ id: "folder_delete", text: "Delete Folder", action: (id:string)=>onDeleteFolder(node,id) });
            menuItems.push({ id: "folder_rename", text: "Rename Folder", action: (id:string)=>onRenameFolder(node,id) });
        } else {
            menuItems.push({ id: "file_delete", text: "Delete Study", action: (id:string)=>onDeleteStudy(node,id) });
            menuItems.push({ id: "file_rename", text: "Rename Study", action: (id:string)=>onRenameStudy(node,id) });
        }
        const onContextMenu = useContextMenu({
            items: menuItems,
        });
        onContextMenu(e);
    }

    return (
        <TreeView
            root={rootNode()}
            onSelectedChanged={(node) => props.onSelectedFileChanged?.(node?.data!)}
            onNodeClick={(node) => props.onNodeClick?.(node.data!)}
            renderNode={(node, refresh) => <span onContextMenu={(e) => onContextMenuInternal(e,node,refresh)}>{node.label}</span>}
            renderExpandedIndicator={
                (isExpanded, _node) => isExpanded ? <IconChevronDown /> : <IconChevronRight />
            }
        />
    );
};

export default FileBrowser;