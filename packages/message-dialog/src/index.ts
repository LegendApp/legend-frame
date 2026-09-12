import Native from "./NativeDesktopMessageDialog";
export type MessageOptions = { title: string; message?: string; kind?: "info" | "warning" | "error"; buttons?: string[]; defaultButton?: number; cancelButton?: number; windowId?: string; checkbox?: { label: string; checked?: boolean } };
export async function showMessage(options: MessageOptions): Promise<{ button: number; checked: boolean }> {
  const buttons = options.buttons ?? ["OK"];
  if (!options.title || !buttons.length || buttons.length > 4 || buttons.some(value => typeof value !== "string" || !value)) throw new Error("Dialog needs a title and 1–4 named buttons");
  for (const index of [options.defaultButton, options.cancelButton]) if (index !== undefined && (!Number.isInteger(index) || index < 0 || index >= buttons.length)) throw new Error("Dialog button index is out of bounds");
  if (options.kind && !["info", "warning", "error"].includes(options.kind)) throw new Error("Invalid dialog kind");
  return JSON.parse(await Native.call("show", JSON.stringify({ ...options, buttons })));
}
export async function confirm(message: string, options: { title?: string; windowId?: string } = {}) {
  const result = await showMessage({ title: options.title ?? "Confirm", message, windowId: options.windowId, buttons: ["Cancel", "Continue"], defaultButton: 1, cancelButton: 0 });
  return result.button === 1;
}
