// Keyboard shortcuts of the game editor, and their help (O.2). Which key does what lives in
// models/shortcuts.ts; this hooks it to the editor's state.

import { Accessor, For, onCleanup, onMount, Setter, Signal } from "solid-js";
import Modal from "../common/Modal";
import { GameModel } from "../../models/GameModel";
import { isMoveNode, Path } from "../../models/pgn";
import { SHORTCUTS, ShortcutAction, shortcutFor } from "../../models/shortcuts";

type ShortcutsOptions = {
    game: Accessor<GameModel | undefined>;
    currentPath: Accessor<Path | undefined>;
    setCurrentPath: Setter<Path | undefined>;
    flip: () => void;
    engineAnalysisOn: Signal<boolean>;
    threatOn: Signal<boolean>;
    /** Plays the engine's best move in the position shown, if it has one */
    playBestMove: () => void;
    /** Moving through the game is allowed (not while playing the engine or in a puzzle) */
    canNavigate: Accessor<boolean>;
    /** The editor takes keys now (a side panel takes them only after a click inside it) */
    isActive: Accessor<boolean>;
    help: Signal<boolean>;
};

export function useShortcuts(o: ShortcutsOptions) {
    const node = (path: Path) => o.game()?.nodeAt(path);

    const go = (path: Path | undefined) => path && o.setCurrentPath(path);

    const variation = (step: 1 | -1) => {
        const path = o.currentPath();
        if (!path || path.size() === 0) return;
        const siblings = node(path.previous())?.children ?? [];
        const i = siblings.findIndex((c) => c.data.path.equals(path));
        go(siblings[i + step]?.data.path);
    };

    const actions: Record<ShortcutAction, () => void> = {
        previous: () => {
            const path = o.currentPath();
            if (path && path.size() > 0) go(path.previous());
        },
        next: () =>
            go(node(o.currentPath() ?? Path.root)?.children[0]?.data.path),
        start: () => go(Path.root),
        end: () => {
            let n = node(o.currentPath() ?? Path.root);
            while (n?.children[0]) n = n.children[0];
            if (n && isMoveNode(n)) go(n.data.path);
        },
        previousVariation: () => variation(-1),
        nextVariation: () => variation(1),
        flip: o.flip,
        engine: () => o.engineAnalysisOn[1]((on) => !on),
        threat: () => {
            const on = !o.threatOn[0]();
            o.threatOn[1](on);
            if (on) o.engineAnalysisOn[1](true);
        },
        bestMove: o.playBestMove,
        help: () => o.help[1]((open) => !open),
    };

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.defaultPrevented || !o.isActive()) return;
        const target = e.target as HTMLElement | null;
        const action = shortcutFor({
            key: e.key,
            shiftKey: e.shiftKey,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            altKey: e.altKey,
            targetTag: target?.tagName,
            targetEditable: target?.isContentEditable,
        });
        if (!action) return;
        const shortcut = SHORTCUTS.find((s) => s.action === action)!;
        if (shortcut.navigates && !o.canNavigate()) return;
        // arrows and space would also scroll the page
        e.preventDefault();
        actions[action]();
    };

    onMount(() => {
        document.addEventListener("keydown", onKeyDown);
        onCleanup(() => document.removeEventListener("keydown", onKeyDown));
    });
}

/** The list of shortcuts, in a dialog. */
export const ShortcutsHelp = (props: { open: Signal<boolean> }) => (
    <Modal
        isOpen={props.open}
        onClose={() => props.open[1](false)}
        title={() => "Keyboard shortcuts"}
    >
        <table class="table is-narrow is-fullwidth shortcuts-help">
            <tbody>
                <For each={SHORTCUTS}>
                    {(s) => (
                        <tr>
                            <td>
                                <For each={s.keys}>{(k) => <kbd>{k}</kbd>}</For>
                            </td>
                            <td>{s.description}</td>
                        </tr>
                    )}
                </For>
            </tbody>
        </table>
        <p class="help">
            Keys typed in a text field are left alone. In the PDF reader, the
            notes take keys after a click inside them.
        </p>
    </Modal>
);
