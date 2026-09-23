import { useEffect } from "react";
import { Platform } from "react-native";
import { onOpen } from "@legendapp/spark/links";
import { mountSerial } from "./lifetime";
import type { OpenFilesProps } from "./OpenFiles";
// onOpen replays queued launches to each subscription. Remounts must not import twice.
const imported = new Set<string>();
const importing = new Set<string>();
export function OpenFiles({ windowId = "main", onFile, onError }: OpenFilesProps) {
  useEffect(() => {
    if (windowId !== "main") return;
    return mountSerial("file-activation", async retain => { await retain(onOpen(event => {
      if (event.type !== "openFile") return;
      if (imported.has(event.id) || importing.has(event.id)) return;
      const match = /^file:\/\/(?:localhost)?(\/.*)$/.exec(event.url);
      if (!match) { onError("Unsupported file URL"); return; }
      importing.add(event.id);
      void (async () => {
        let path = decodeURIComponent(match[1]!);
        if (Platform.OS === "windows") path = path.replace(/^\/([a-z]:)/i, "$1").replace(/\//g, "\\");
        await onFile(path);
        imported.add(event.id);
        if (imported.size > 200) imported.delete(imported.values().next().value!);
      })().catch(error => onError(String(error))).finally(() => importing.delete(event.id));
    })); }, onError);
  }, [windowId, onFile, onError]);
  return null;
}
