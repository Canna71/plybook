import { useSearchParams } from "@solidjs/router";
import {
    createNewDataFile,
    deleteDataFileOrFolder,
    getDefaultStudyContent,
    listAppData,
    NameWithoutExtension,
    renameOrCreateDataFile,
} from "../storage/fs";
import {
    batch,
    createEffect,
    createResource,
    For,
    Show,
    useContext,
} from "solid-js";
import { sep } from "@tauri-apps/api/path";
import Button from "../components/common/Button";
import { ContentContext } from "../components/common/ContentContext";
import Editable from "../components/common/Editable";
import {
    IconCircleXFilled,
    IconEdit,
    IconPlus,
    IconRefresh,
} from "@tabler/icons-solidjs";

import "./LibraryFolder.scss";
import BreadCrumb from "../components/common/BreadCrumb";

const LibraryFolder = () => {
    const [searchParams] = useSearchParams();
    const { renaming, setRenaming } = useContext(ContentContext)!;

    const folderPath = () => {
        if (typeof searchParams.path === "string") {
            return searchParams.path;
        }
        return undefined;
    };

    const fetchFiles = async (path: string) => {
        const ret = await listAppData(path);
        const arr = ret.filter((de) => de.isFile && de.name.endsWith(".pgn"));
        return arr;
    };

    const [files, { refetch }] = createResource(folderPath, fetchFiles);

    const getFullPath = (name: string) => {
        const fullPath = `${folderPath()}${sep()}${name}`;
        return fullPath;
    };

    createEffect(() => {
        refetch();
    });

    const onRename = (name: string) => {
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
            refetch();
        });
    };

    const onDelete = async (name: string) => {
        await deleteDataFileOrFolder(getFullPath(name));
        refetch();
    };

    const newStudy = async () => {
        const newPath = await createNewDataFile(
            folderPath()!,
            "Untitled.pgn",
            getDefaultStudyContent(),
        );
        batch(() => {
            // setExpandedNodes(new Set(expandedNodes()).add(node.id));
            refetch();
            setRenaming(newPath);
        });
        // setTimeout(()=>setRenaming(newPath),100);
    };

    return (
        <div class="library-folder">
            <div class="buttons-bar">
                <Button class="is-primary is-outlined" onClick={refetch}>
                    <IconRefresh />
                </Button>
                <Button class="is-primary is-outlined" onClick={newStudy}>
                    <IconPlus />
                    New Study
                </Button>
            </div>

            <BreadCrumb path={folderPath} />

            <div class="table-container">
                <table class="table files_table is-hoverable is-fullwidth">
                    <colgroup>
                        <col width={"99%"} />
                    </colgroup>
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
                                                initialValue={NameWithoutExtension(
                                                    file.name,
                                                )}
                                                editable={() => true}
                                                onSave={onRenamed}
                                                focus={true}
                                            />
                                        </Show>
                                    </td>
                                    <td>
                                        <Button
                                            title="Rename"
                                            onClick={() => onRename(file.name)}
                                        >
                                            <IconEdit />
                                        </Button>
                                        <Button
                                            class=""
                                            title="Delete"
                                            onClick={() => onDelete(file.name)}
                                        >
                                            <IconCircleXFilled />
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
