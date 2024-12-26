import { createSignal } from 'solid-js';
import TreeView, { TreeNode } from '../common/TreeView';
import { listAppData } from '../../storage/fs';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-solidjs';

type FileBrowserProps = {
    rootFolder: FileBrowserFile;
    // fetchFiles: (path: string) => Promise<TreeNode<FileBrowserFile>[]>;
    onSelectedFileChanged: (file: FileBrowserFile) => void;
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
            label: file.name,
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
        label: props.rootFolder.name,
        loadChildren: async () => directoryToNodes(props.rootFolder.path),
    });

    // onMount(async () => {
    //     // const children = await props.fetchFiles(props.basePath);
    //     setRootNode({
    //         ...rootNode(),
    //         children,
    //     });
    // });

    return (
        <TreeView
            root={rootNode()}
            onSelectedChanged={(node) => props.onSelectedFileChanged(node?.data!)}
            renderNode={(node) => <span>{node.label}</span>}
            renderExpandedIndicator={
                (isExpanded, node) => isExpanded ? <IconChevronDown /> : <IconChevronRight />
            }
        />
    );
};

export default FileBrowser;