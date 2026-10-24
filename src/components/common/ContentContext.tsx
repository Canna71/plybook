import { Accessor, Setter, createContext, createSignal } from "solid-js";

export interface ContentContext {
    onRefresh: Accessor<number>;
    refresh: () => void;
    renaming: Accessor<string | undefined>;
    setRenaming: Setter<string | undefined>;
}

export const ContentContext = createContext<ContentContext>();
const [refreshTrigger, setRefreshTrigger] = createSignal(0);
const [renaming, setRenaming] = createSignal<string | undefined>(undefined);

export function useContentContext(): ContentContext {
    // This will be our trigger for updates

    return {
        onRefresh: refreshTrigger,
        refresh: () => setRefreshTrigger((v) => v + 1),
        renaming,
        setRenaming,
    };
}
