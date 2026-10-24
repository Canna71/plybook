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

    const isPdf = (name: string) => name.toLowerCase().endsWith(".pdf");

    const fetchFiles = async (path: string) => {
        const ret = await listAppData(path);
        const arr = ret.filter(
            (de) => de.isFile && (de.name.endsWith(".pgn") || isPdf(de.name)),
        );
        return arr;
    };

    /** PGN games open in the editor, PDF books in the reader. */
    const openLink = (name: string) =>
        isPdf(name)
            ? `/reader?path=${encodeURIComponent(getFullPath(name))}`
            : `/game?path=${encodeURIComponent(getFullPath(name))}&source=library`;

    // a PDF chosen in the file picker is copied into this folder
    const addPdf = async (e: Event) => {
        const input = e.currentTarget as HTMLInputElement;
        const file = input.files?.[0];
        input.value = "";
        if (!file) return;
        await createNewDataFile(
            folderPath()!,
            file.name,
            new Uint8Array(await file.arrayBuffer()),
        );
        refetch();
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
                <label
                    class="button is-primary is-outlined"
                    title="Copy a PDF book into this folder, to read it in ReChess"
                >
                    <input
                        type="file"
                        accept="application/pdf,.pdf"
                        hidden
                        onChange={addPdf}
                    />
                    <IconPlus />
                    Add PDF…
                </label>
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
                                            <a href={openLink(file.name)}>
                                                {NameWithoutExtension(
                                                    file.name,
                                                )}
                                                <Show when={isPdf(file.name)}>
                                                    {" "}
                                                    <span class="tag is-light">
                                                        PDF
                                                    </span>
                                                </Show>
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
