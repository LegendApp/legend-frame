import React, { useEffect, useRef, useState } from "react";
import { Button, Text, View } from "react-native";
import * as notifications from "@legend-apps/desktop/notifications";
import { createTray } from "@legend-apps/desktop/tray";
import * as updates from "@legend-apps/desktop/updates";
import { showWindow } from "@legend-apps/desktop/windows";

export function Integrations({ report }: { report: (value: unknown) => void }) {
  const [permission, setPermission] = useState<string>("Loading…");
  const [trayActive, setTrayActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<updates.UpdateStatus>();
  const tray = useRef<Awaited<ReturnType<typeof createTray>> | undefined>(undefined);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    let response: { remove(): void } | undefined;
    let disposed = false;
    void notifications.getNotificationPermission().then(value => { if (!disposed) setPermission(value); }).catch(report);
    void notifications.onNotificationResponse(report).then(value => { if (disposed) value.remove(); else response = value; }).catch(report);
    void updates.getUpdateStatus().then(async value => { if (!disposed) setUpdateStatus(value.available ? await updates.startUpdates() : value); }).catch(report);
    const events = updates.onUpdateEvent(report);
    return () => { disposed = true; mounted.current = false; response?.remove(); events.remove(); void tray.current?.remove().catch(report); tray.current = undefined; };
  }, [report]);
  async function act(fn: () => Promise<unknown>) { try { await fn(); } catch (error) { report(String(error)); } }
  async function toggleTray() {
    setBusy(true);
    try {
      if (tray.current) { await tray.current.remove(); tray.current = undefined; if (mounted.current) setTrayActive(false); }
      else {
        const item = await createTray({ id: "kitchen", symbol: "cup.and.saucer", tooltip: "Desktop Kitchen Sink", menu: [
          { id: "open", title: "Show kitchen sink" }, { separator: true }, { id: "checked", title: "Checked item", checked: true }, { id: "disabled", title: "Disabled item", enabled: false },
        ] }, event => { report(event); if (event.itemId === "open") void showWindow().catch(report); });
        if (!mounted.current) await item.remove(); else { tray.current = item; setTrayActive(true); }
      }
    } finally { if (mounted.current) setBusy(false); }
  }
  return <View style={{ gap: 18 }}>
    <Text style={{ fontSize: 18, fontWeight: "600", color: "#152238" }}>Notifications</Text>
    <Text style={{ color: "#34435a" }}>Permission: {permission}. Go shares its host’s notification permission.</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      <Button title="Enable notifications" onPress={() => void act(async () => setPermission(await notifications.requestNotificationPermission()))} />
      <Button title="Send test notification" onPress={() => void act(async () => { await notifications.showNotification({ id: "kitchen-demo", title: "Hello from the kitchen sink", body: "Click to exercise notification responses.", data: { screen: "kitchen" } }); report("Notification submitted"); })} />
      <Button title="Clear project notifications" onPress={() => void act(notifications.clearNotifications)} />
    </View>
    <Text style={{ fontSize: 18, fontWeight: "600", color: "#152238" }}>Menu bar</Text>
    <View style={{ flexDirection: "row", gap: 12 }}>
      <Button title={trayActive ? "Remove menu-bar item" : "Create menu-bar item"} disabled={busy} onPress={() => void act(toggleTray)} />
      <Button title="Update menu-bar title" disabled={!trayActive || busy} onPress={() => void act(async () => { await tray.current?.update({ title: "Hello" }); })} />
    </View>
    <Text style={{ fontSize: 18, fontWeight: "600", color: "#152238" }}>App updates</Text>
    <Text style={{ color: "#34435a" }}>{updateStatus?.available ? "Signed updates configured" : `Updates unavailable: ${updateStatus?.reason ?? "Loading…"}`}</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
      <Button title="Check for updates" disabled={!updateStatus?.available} onPress={() => void act(updates.checkForUpdates)} />
      <Button title={updateStatus?.automaticallyChecks ? "Disable automatic checks" : "Enable automatic checks"} disabled={!updateStatus?.available} onPress={() => void act(async () => { await updates.setAutomaticUpdateChecks(!updateStatus?.automaticallyChecks); setUpdateStatus(await updates.getUpdateStatus()); })} />
    </View>
  </View>;
}
