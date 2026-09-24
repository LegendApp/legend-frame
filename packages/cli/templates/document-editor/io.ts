import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Alert } from "react-native";
import type { DocumentIO } from "./document";
export const io: DocumentIO = {
  async open() {
    const result = await DocumentPicker.getDocumentAsync({ type: ["text/*", "application/json"], copyToCacheDirectory: true });
    if (result.canceled) return null;
    const asset = result.assets[0]!;
    if ((asset.size ?? 0) > 8 * 1024 * 1024) throw new Error("Choose a text file smaller than 8 MB");
    // The picker returns an imported copy, not permission to overwrite the source.
    return { file: { name: asset.name }, text: await FileSystem.readAsStringAsync(asset.uri) };
  },
  async save(file, text) {
    if (!await Sharing.isAvailableAsync()) throw new Error("File sharing is unavailable on this device");
    const directory = FileSystem.documentDirectory;
    if (!directory) throw new Error("Document storage is unavailable");
    const name = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "Untitled.txt";
    const location = `${directory}spark-${name}`;
    await FileSystem.writeAsStringAsync(location, text);
    await Sharing.shareAsync(location, { mimeType: "text/plain", UTI: "public.plain-text" });
    // Save commits the app's durable copy, regardless of share-sheet dismissal.
    return { name: file.name, location };
  },
  confirmDiscard: name => new Promise(resolve => Alert.alert("Unsaved changes", `Save a copy of ${name}?`, [
    { text: "Cancel", style: "cancel", onPress: () => resolve("cancel") },
    { text: "Discard", style: "destructive", onPress: () => resolve("discard") },
    { text: "Save", onPress: () => resolve("save") },
  ], { cancelable: false })),
};
