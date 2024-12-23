import { Menu, MenuOptions } from "@tauri-apps/api/menu";

export function useContextMenu(options: MenuOptions) {
    const menuPromise = Menu.new(options);

	// context menu functions

	const onContextMenu = async (e: MouseEvent) => {
		e.preventDefault();
		const menu = await menuPromise;

		menu.popup();
	}
    return onContextMenu;
}