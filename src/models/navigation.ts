// The app's navigation (UX overhaul, step 2): the screens grouped by what you came to do, used
// by the sidebar and the command palette. No DOM here, for tests.

export type NavItem = {
    id: string;
    label: string;
    /** Icon name, mapped to a component by the sidebar */
    icon: string;
    route: string;
    /** Other routes that belong to this screen (an open game belongs to the Library) */
    owns?: string[];
    /** Extra words the command palette matches */
    keywords?: string;
};

export type NavGroup = { label?: string; items: NavItem[] };

export const NAVIGATION: NavGroup[] = [
    {
        items: [{ id: "today", label: "Today", icon: "home", route: "/" }],
    },
    {
        label: "Study",
        items: [
            {
                id: "analysis",
                label: "Analysis",
                icon: "analysis",
                route: "/analysis",
                keywords: "board engine new game",
            },
            {
                id: "library",
                label: "Library",
                icon: "library",
                route: "/library?path=Library",
                owns: ["/library", "/game", "/guess"],
                keywords: "files pgn studies",
            },
            {
                id: "books",
                label: "Books",
                icon: "book",
                route: "/books",
                owns: ["/reader", "/scan-book"],
                keywords: "pdf reader read scanned diagrams",
            },
            {
                id: "repertoires",
                label: "Repertoires",
                icon: "repertoire",
                route: "/repertoires",
                owns: ["/repertoire"],
                keywords: "openings training",
            },
        ],
    },
    {
        label: "Train",
        items: [
            {
                id: "puzzles",
                label: "Puzzles",
                icon: "puzzle",
                route: "/puzzles",
                owns: ["/puzzle"],
                keywords: "tactics lichess mistakes",
            },
        ],
    },
    {
        label: "Play",
        items: [
            {
                id: "play",
                label: "Play the engine",
                icon: "play",
                route: "/play",
                keywords: "game clock",
            },
        ],
    },
    {
        label: "Games",
        items: [
            {
                id: "history",
                label: "History",
                icon: "history",
                route: "/history",
                keywords: "my games played",
            },
            {
                id: "databases",
                label: "Databases",
                icon: "database",
                route: "/databases",
                keywords: "search import pgn masters",
            },
        ],
    },
    {
        label: "Tools",
        items: [
            {
                id: "scan",
                label: "Scan a position",
                icon: "scan",
                route: "/scan",
                keywords: "screenshot image capture book diagram",
            },
            {
                id: "boardeditor",
                label: "Board editor",
                icon: "editor",
                route: "/boardeditor",
                keywords: "setup position fen",
            },
            {
                id: "sites",
                label: "Chess sites",
                icon: "sites",
                route: "/sites",
                keywords: "chessable chess.com lichess browser web copy",
            },
        ],
    },
];

export const SETTINGS_ITEM: NavItem = {
    id: "settings",
    label: "Settings",
    icon: "settings",
    route: "/settings",
    keywords: "preferences engines appearance theme backups accounts",
};

export const HELP_ITEM: NavItem = {
    id: "help",
    label: "Help",
    icon: "help",
    route: "/help",
    keywords: "guide manual how to documentation",
};

/** Every screen, in sidebar order, Help and Settings last. */
export const allNavItems = (): NavItem[] => [
    ...NAVIGATION.flatMap((g) => g.items),
    HELP_ITEM,
    SETTINGS_ITEM,
];

/** The Help screen at a screen's section of the user guide (docs/GUIDE.md) */
export const helpRoute = (pathname: string) => {
    const id = activeNavItem(pathname)?.id;
    return id && id !== "help" ? `/help?section=${id}` : "/help";
};

const pathOf = (route: string) => route.split("?")[0];

/** The screen a location belongs to (its own route, or one it owns). */
export function activeNavItem(pathname: string): NavItem | undefined {
    return allNavItems().find(
        (item) =>
            pathOf(item.route) === pathname ||
            item.owns?.some((r) => r === pathname),
    );
}
