import { Menu, MenuOptions } from "@tauri-apps/api/menu";

export function useContextMenu(options: MenuOptions) {
    // context menu functions

    const onContextMenu = async (e: MouseEvent) => {
        e.preventDefault();
        const menuPromise = Menu.new(options);
        const menu = await menuPromise;

        menu.popup();
    };
    return onContextMenu;
}
