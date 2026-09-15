import * as files from "@legend-apps/file-system";
import { settings } from "@legend-apps/settings";
import { filesystemLifecycle, settingsLifecycle } from "./desktop-contract-cases";
export async function runDesktopContracts(check: (id: string, action: () => Promise<void>) => Promise<void>, token: string) {
  await check("desktop.filesystem", () => filesystemLifecycle(files, token));
  await check("desktop.settings", () => settingsLifecycle(settings, token));
}
