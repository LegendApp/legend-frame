import * as files from "@legend-apps/file-system";
import * as links from "@legend-apps/desktop-links";
import { settings } from "@legend-apps/settings";
import { filesystemLifecycle, settingsLifecycle, recentDocumentsLifecycle } from "./desktop-contract-cases";
export async function runDesktopContracts(check: (id: string, action: () => Promise<void>) => Promise<void>, token: string) {
  await check("desktop.filesystem", () => filesystemLifecycle(files, token));
  await check("desktop.recent-documents", () => recentDocumentsLifecycle(files, links, token));
  await check("desktop.settings", () => settingsLifecycle(settings, token));
}
