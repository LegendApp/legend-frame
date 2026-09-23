import { io as desktop } from "./io.desktop";
import { showMessage } from "@legendapp/spark/message-dialog";
import type { DocumentIO } from "./document";
export const io: DocumentIO = { ...desktop, async confirmDiscard(name) {
  const { button } = await showMessage({ title: "Unsaved changes", message: `Save changes to ${name}?`, buttons: ["Cancel", "Discard", "Save"], cancelButton: 0, defaultButton: 2 });
  return (["cancel", "discard", "save"] as const)[button] ?? "cancel";
} };
