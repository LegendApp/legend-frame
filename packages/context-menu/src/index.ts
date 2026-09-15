import { Platform } from "react-native";
import NativeContextMenu from "./NativeContextMenu";

export type ContextMenuItem = {
  id: string;
  title: string;
  enabled?: boolean;
  checked?: boolean;
  separator?: boolean;
};

export type ContextMenuLocation = {
  x: number;
  y: number;
};

export async function showContextMenu(items: ContextMenuItem[], location: ContextMenuLocation) {
  if (Platform.OS !== "macos" && Platform.OS !== "windows") {
    return null;
  }

  if (!Number.isFinite(location.x) || !Number.isFinite(location.y)) throw new Error("Menu location must be finite");
  const ids = items.filter(item => !item.separator).map(item => item.id);
  if (new Set(ids).size !== ids.length) throw new Error("Context menu ids must be unique");
  const result = await NativeContextMenu.showMenu(JSON.stringify(items), JSON.stringify(location));
  return result.length > 0 ? result : null;
}

export { default as NativeContextMenu } from "./NativeContextMenu";
