import { Accessor, Setter, createContext } from "solid-js";

export interface ContentContext {
    refreshTrigger: Accessor<number>;
    refresh: () => void;
}


export const ContentContext = createContext<ContentContext>();