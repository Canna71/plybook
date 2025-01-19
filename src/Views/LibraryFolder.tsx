import { useSearchParams } from "@solidjs/router";
import { listAppData } from "../storage/fs";
import { createResource, For } from "solid-js";

const LibraryFolder = () => {
    const [searchParams] = useSearchParams();
    

    const folderPath = () => {
        console.log("folderPath", searchParams.path);
        if (typeof searchParams.path === "string") {
            return searchParams.path;
        }
        return undefined;
    };

    const fetchFiles = async (path: string) => {
        console.log("fetching files for", path);
        const ret = await listAppData(path);
        console.log(ret);
        return ret.filter((de) => de.isFile);
    }

    const [files] = createResource(folderPath,fetchFiles)

    

    return (
        <div>
            <h1>Library Folder</h1>
            <h2>{folderPath()}</h2>
            <For each={files()}>{(file) => <div>{file.name}</div>}</For>
        </div>
    );
};

export default LibraryFolder;
