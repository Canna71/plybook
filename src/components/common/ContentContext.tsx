import { Accessor, Setter, createContext, createSignal } from "solid-js";

export interface ContentContext {
    refreshTrigger: Accessor<number>;
    refresh: () => void;
    renaming: Accessor<string | undefined>;
    setRenaming: Setter<string | undefined>;
}

export const ContentContext = createContext<ContentContext>();

export function useContentContext() {
    // This will be our trigger for updates
    const [refreshTrigger, setRefreshTrigger] = createSignal(0);
    const [renaming, setRenaming] = createSignal<string | undefined>(undefined);
    return {
        refreshTrigger,
        refresh: () => setRefreshTrigger((v) => v + 1),
        renaming,
        setRenaming,
    };
}
