import { useSearchParams } from "@solidjs/router";
import {
    deleteDataFileOrFolder,
    listAppData,
    NameWithoutExtension,
    renameOrCreateDataFile,
} from "../storage/fs";
import { batch, createEffect, createResource, For, Show, useContext } from "solid-js";
import { sep } from "@tauri-apps/api/path";
import Button from "../components/common/Button";
import { ContentContext } from "../components/common/ContentContext";
import Editable from "../components/common/Editable";
import { IconRefresh } from "@tabler/icons-solidjs";

const LibraryFolder = () => {
    const [searchParams] = useSearchParams();
    const { renaming, setRenaming, refresh, onRefresh } = useContext(ContentContext)!;

    const folderPath = () => {
        if (typeof searchParams.path === "string") {
            return searchParams.path;
        }
        return undefined;
    };

    const fetchFiles = async (path: string) => {
        console.log("fetching files for", path);
        const ret = await listAppData(path);
        console.log(ret);
        const arr = ret.filter((de) => de.isFile && de.name.endsWith(".pgn"));
        console.log(arr);
        return arr;
    };

    const [files, {refetch}] = createResource(folderPath, fetchFiles);

    const getFullPath = (name: string) => {
        const fullPath = `${folderPath()}${sep()}${name}`;
        return fullPath;
    };

    createEffect(() => {
        console.log("refreshing");
        const refreshTrigger = onRefresh();
        refetch();
    });

    const onRename = (name: string) => {
        console.log("rename", name);
        setRenaming(getFullPath(name));
    };

    const isRenaming = (name: string) => {
        return renaming() === getFullPath(name);
    };

    const onRenamed = async (newName: string) => {
        // await renameOrCreateDataFile(renaming(), newName);
        await renameOrCreateDataFile(renaming(), newName);
        batch(() => {
            setRenaming(undefined);
            refresh();
        });
    };

    const onDelete = async (name: string) => {
        console.log("delete", name);
        await deleteDataFileOrFolder(getFullPath(name));
        refresh();
    }

    return (
        <div>
            <h1>Library Folder</h1>
            <Button onClick={refetch}>
                <IconRefresh />
            </Button>
            <h2>{folderPath()}</h2>
            <div class="table-container">
                <table class="table puzzles_table is-hoverable">
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        <For
                            each={files()}
                            fallback={
                                <tr>
                                    <td>No Items</td>
                                </tr>
                            }
                        >
                            {(file) => (
                                <tr class=" ">
                                    <td>
                                        <Show when={!isRenaming(file.name)}>
                                            <a
                                                href={`/game?path=${getFullPath(file.name)}&source=library`}
                                            >
                                                {NameWithoutExtension(
                                                    file.name,
                                                )}
                                            </a>
                                        </Show>
                                        <Show when={isRenaming(file.name)}>
                                            <Editable
                                                initialValue={file.name}
                                                editable={() => true}
                                                onSave={onRenamed}
                                                focus={true}
                                            />
                                        </Show>
                                    </td>
                                    <td>
                                        <Button
                                            onClick={() => onRename(file.name)}
                                        >
                                            Rename
                                        </Button>
                                        <Button
                                            onClick={() => onDelete(file.name)}
                                        >
                                            Delete
                                        </Button>
                                    </td>
                                </tr>
                            )}
                        </For>
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default LibraryFolder;
