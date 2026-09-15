import { useRef, useState } from "react";
import { Text, View } from "react-native";
import { Button } from "@legend-apps/ui";
import { showMessage } from "@legend-apps/message-dialog";
import { showContextMenu } from "@legend-apps/context-menu";
import { createTray } from "@legend-apps/tray";
import { registerGlobalShortcut } from "@legend-apps/global-shortcuts";
import { getWindow } from "@legend-apps/desktop-windows";
import { assertContract } from "./contract-cases";

async function requireError(action: () => Promise<unknown>, code: string) {
  try { await action(); } catch (error) { assertContract((error as { code?: string }).code === code, `Expected ${code}: ${String(error)}`); return; }
  throw new Error(`Expected ${code}`);
}
export default function DesktopInteractionChecks({ check, onError, onBusy }: {
  check: (id: string, action: () => Promise<void>) => Promise<void>; onError: (message: string) => void; onBusy: (busy: boolean) => void;
}) {
  const anchor = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [instruction, setInstruction] = useState("Check native dialogs and menus before finishing the run.");
  function run(id: string, action: () => Promise<void>) {
    setBusy(true); onBusy(true);
    void check(id, action).catch(error => onError(String(error))).finally(() => { setBusy(false); onBusy(false); });
  }
  async function dialogs() {
    await requireError(() => showMessage({ title: "Missing parent", windowId: "nonexistent-contract-parent" }), "E_NOT_FOUND");
    setInstruction("Check Remember, then press Enter for Continue. In the next dialog, press Escape.");
    const first = showMessage({ title: "Dialog acceptance", message: "Check Remember, then press Enter to choose Continue. Cancel is also available with Escape.",
      windowId: "main", kind: "warning", buttons: ["Cancel", "Ignore", "Continue", "Other"], defaultButton: 2, cancelButton: 0, checkbox: { label: "Remember", checked: false } });
    // Attach handlers immediately; an unexpected native rejection must not leak.
    const [selected] = await Promise.all([first, (async () => { await requireError(() => showMessage({ title: "Must reject while busy" }), "E_BUSY"); })()]);
    assertContract(selected.button === 2 && selected.checked, "Expected Continue (index 2) and checked checkbox");
    const cancelled = await showMessage({ title: "Cancel acceptance", message: "Press Escape. Remember should already be checked.", kind: "info",
      buttons: ["Cancel", "Continue"], defaultButton: 1, cancelButton: 0, checkbox: { label: "Remember", checked: true } });
    assertContract(cancelled.button === 0 && cancelled.checked, "Escape did not return the configured cancel index and checkbox state");
    setInstruction("Dialog assertions finished. Also check parent modality, all button labels, and keyboard focus visually.");
  }
  async function menus(location: { x: number; y: number }) {
    setInstruction("Choose Continue in the first menu. Check the marked item and disabled item visually. Dismiss the second menu with Escape.");
    const items = [
      { id: "marked", title: "Checked item", checked: true },
      { id: "disabled", title: "Disabled item", enabled: false },
      { id: "separator", title: "", separator: true },
      { id: "continue", title: "Continue" },
    ];
    const first = showContextMenu(items, location);
    const [selected] = await Promise.all([first, (async () => { await requireError(() => showContextMenu(items, location), "E_BUSY"); })()]);
    assertContract(selected === "continue", "Menu did not return the selected semantic ID");
    assertContract(await showContextMenu([{ id: "cancel", title: "Press Escape to dismiss" }], location) === null, "Dismissed menu must return null");
    setInstruction("Menu assertions finished. Also check placement, disabled/checked states, and keyboard navigation visually.");
  }
  async function tray() {
    setInstruction("Open the app icon in the tray/menu bar and choose Checks → Continue. On Windows it may be in the hidden-icons overflow.");
    let selected!: () => void;
    const action = new Promise<void>(resolve => { selected = resolve; });
    const item = await createTray({ id: "contract-tray", title: "Check", tooltip: "Legend tray acceptance" }, event => { if (event.type === "trayAction" && event.itemId === "continue") selected(); });
    try {
      await requireError(() => createTray({ id: "contract-tray", title: "Duplicate" }), "E_TRAY_EXISTS");
      await item.update({ menu: [{ id: "checks", title: "Checks", items: [
        { id: "marked", title: "Checked", checked: true }, { id: "disabled", title: "Disabled", enabled: false },
        { separator: true }, { id: "continue", title: "Continue" },
      ] }] });
      await within(action, 45000);
    } finally { await item.remove(); await item.remove(); }
    setInstruction("Tray action and removal passed. Verify its icon disappeared.");
  }
  async function globalShortcut() {
    setInstruction("Focus another application, then press Control+Alt+Shift+F11 within 45 seconds.");
    let pressed!: () => void;
    const action = new Promise<void>(resolve => { pressed = resolve; });
    const accelerator = "Control+Alt+Shift+F11";
    const registration = await registerGlobalShortcut(accelerator, pressed);
    try {
      await requireError(() => registerGlobalShortcut(accelerator, () => {}), "E_SHORTCUT_CONFLICT");
      await within(action, 45000);
      assertContract(!(await getWindow()).focused, "Shortcut must be tested while another application has focus");
    } finally { await registration.remove(); await registration.remove(); }
    const replacement = await registerGlobalShortcut(accelerator, () => {}); await replacement.remove();
    setInstruction("Global shortcut, conflict rejection, removal, and re-registration passed.");
  }
  return <View style={{ gap: 8 }}>
    <Text>{instruction}</Text>
    <Button disabled={busy} onPress={() => run("desktop.tray", tray)}>Check tray</Button>
    <Button disabled={busy} onPress={() => run("desktop.global-shortcuts", globalShortcut)}>Check global shortcut</Button>
    <Button testID="legend-message-dialog" disabled={busy} onPress={() => run("desktop.message-dialog", dialogs)}>Check message dialogs</Button>
    <View ref={anchor} collapsable={false}>
      <Button testID="legend-context-menu" disabled={busy} onPress={() => anchor.current?.measureInWindow((x, y, _width, height) => run("desktop.context-menu", () => menus({ x, y: y + height })))}>Check context menus</Button>
    </View>
  </View>;
}

async function within(action: Promise<void>, ms: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { await Promise.race([action, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Interaction timed out")), ms); })]); }
  finally { clearTimeout(timer); }
}
