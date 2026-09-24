import { spawn } from "@legendapp/spark/processes";
import { startHelper } from "./client";
// Explicitly app-owned: share this service between windows, stop on app shutdown.
let client: ReturnType<typeof startHelper> | undefined;
export function getHelper() {
  if (!client) {
    const pending = startHelper(spawn).catch(error => { if (client === pending) client = undefined; throw error; });
    client = pending;
  }
  return client.then(running => {
    if (running.status !== "ready") throw new Error("Helper is unavailable. Restart it explicitly.");
    return running;
  });
}
/** Explicit restart avoids silently repeating a request whose outcome is unknown. */
export async function stopHelper() {
  const previous = client; client = undefined;
  if (previous) { const running = await previous.catch(() => undefined); await running?.close(); }
}
