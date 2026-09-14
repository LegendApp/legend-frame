import Native from "./NativeFileDialog";
export type { FileDialogOpenOptions, FileDialogSaveOptions } from "./index";
import type { FileDialogOpenOptions, FileDialogSaveOptions } from "./index";
export const openFileDialog = async (options: FileDialogOpenOptions = {}): Promise<string[] | null> => JSON.parse(await Native.open(JSON.stringify(options)));
export const saveFileDialog = async (options: FileDialogSaveOptions = {}): Promise<string | null> => JSON.parse(await Native.save(JSON.stringify(options)));
export const readTextFile = (path: string) => Native.readTextFile(path);
export const writeTextFile = (path: string, contents: string) => Native.writeTextFile(path, contents);
/** Best-effort external-change detection; other processes can replace the file after the comparison. */
export const writeTextFileIfUnchanged = (path: string, expectedContents: string, contents: string) => Native.writeTextFileIfUnchanged(path, expectedContents, contents);
export const revealInFinder = (path: string) => Native.revealInFinder(path);
export { default as NativeFileDialog } from "./NativeFileDialog";
