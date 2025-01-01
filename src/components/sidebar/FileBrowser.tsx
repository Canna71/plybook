import { batch, Component, createEffect, createSignal, useContext } from "solid-js";
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
import FileBrowserItem from "./FileBrowserItem";

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

  

    createEffect(() => {
        const trigger = contentContext?.refreshTrigger();
        console.log("refreshing file browser: ", trigger);
        batch(() => {
            setRootNode({
                ...root,
            });
        });
    });


    return (
        <TreeView
            indentSize={8}
            root={rootNode}
            onSelectedChanged={(node) =>
                props.onSelectedFileChanged?.(node?.data!)
            }
            onNodeClick={(node) => props.onNodeClick?.(node.data!)}
            renderNode={(node) => (
                <FileBrowserItem node={node} />
            )}
            renderExpandedIndicator={(isExpanded, _node) =>
                isExpanded ? <IconChevronDown /> : <IconChevronRight />
            }
        />
    );
};


export default FileBrowser;
