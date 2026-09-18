import { openFileDialog, saveFileDialog, readTextFile, writeTextFile, writeTextFileIfUnchanged } from "@legendapp/frame-file-dialog";
import { Alert } from "react-native";
import type { DocumentIO } from "./document";
export const io: DocumentIO = {
  async open() {
    const paths = await openFileDialog({ allowedFileTypes: ["txt", "md", "json"], allowsMultipleSelection: false });
    if (!paths?.[0]) return null;
    const location = paths[0];
    return { file: { location, name: location.split(/[\\/]/).pop()! }, text: await readTextFile(location) };
  },
  async save(file, text, expected, saveAs) {
    const location = saveAs || !file.location ? await saveFileDialog({ defaultName: file.name, allowedFileTypes: ["txt", "md", "json"] }) : file.location;
    if (!location) return null;
    if (location === file.location) {
      if (!await writeTextFileIfUnchanged(location, expected, text)) throw new Error("The file changed outside the editor. Use Save As to keep your edits in another file.");
    } else await writeTextFile(location, text);
    return { location, name: location.split(/[\\/]/).pop()! };
  },
  confirmDiscard: name => new Promise(resolve => Alert.alert("Unsaved changes", `Save changes to ${name}?`, [
    { text: "Cancel", style: "cancel", onPress: () => resolve("cancel") },
    { text: "Discard", style: "destructive", onPress: () => resolve("discard") },
    { text: "Save", onPress: () => resolve("save") },
  ], { cancelable: false })),
};
