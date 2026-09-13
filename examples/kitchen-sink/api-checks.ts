import * as clipboard from "@legend-apps/desktop/clipboard";
import * as secureStore from "@legend-apps/desktop/secure-storage";
import * as links from "@legend-apps/desktop/links";
import type { TestDriver } from "./test-driver";

type Check = (name: string, action: () => Promise<void>) => Promise<void>;
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) { if (predicate()) return; await delay(25); }
  throw new Error("Expected URL event was not delivered");
}
export async function runAPIChecks(check: Check, driver?: TestDriver, expectedInitial?: string | null) {
  const token = `api-test-${Date.now()}`;
  const native = async (method: string, args: object = {}) => JSON.parse(await driver!.call(method, JSON.stringify(args)));
  await check("Expo clipboard: string read and presence", async () => {
    assert(typeof await clipboard.getStringAsync() === "string", "Expected string");
    assert(typeof await clipboard.hasStringAsync() === "boolean", "Expected boolean");
  });
  if (driver) await check("Expo clipboard: text, HTML, empty string, legacy interop and restoration", async () => {
    await native("saveClipboard");
    try {
      assert(await clipboard.setStringAsync(token) === true, "Write must resolve true");
      assert(await clipboard.getStringAsync() === token && await clipboard.hasStringAsync(), "Text roundtrip failed");
      assert(await clipboard.readClipboardText() === token, "Legacy read must see new write");
      await clipboard.writeClipboardText("legacy");
      assert(await clipboard.getStringAsync() === "legacy", "New read must see legacy write");
      const html = `<b>${token}</b>`;
      await clipboard.setStringAsync(html, { inputFormat: clipboard.StringFormat.HTML });
      assert(await clipboard.getStringAsync({ preferredFormat: clipboard.StringFormat.HTML }) === html, "HTML roundtrip failed");
      assert((await clipboard.getStringAsync()).trim() === token, "HTML plain-text conversion failed");
      await clipboard.writeClipboard({ html });
      assert(await clipboard.hasStringAsync(), "HTML-only clipboard must count as text");
      await clipboard.setStringAsync("");
      assert(await clipboard.getStringAsync() === "", "Empty string changed");
      await clipboard.clearClipboard();
      assert(!await clipboard.hasStringAsync(), "Empty clipboard reports text");
    } finally { await native("restoreClipboard"); }
  });
  await check("Expo SecureStore: availability, missing, write, update, delete and legacy interop", async () => {
    assert(await secureStore.isAvailableAsync(), "Native Keychain unavailable");
    try {
      await secureStore.deleteItemAsync(token);
      assert(await secureStore.getItemAsync(token) === null, "Missing key must be null");
      assert(await secureStore.setItemAsync(token, "test 🌍") === undefined, "Write must resolve void");
      assert(await secureStore.secureStorage.get(token) === "test 🌍", "Legacy read mismatch");
      await secureStore.secureStorage.set(token, "legacy");
      assert(await secureStore.getItemAsync(token) === "legacy", "New read mismatch");
      await secureStore.setItemAsync(token, "");
      assert(await secureStore.getItemAsync(token) === "", "Empty value is not missing");
      await secureStore.deleteItemAsync(token); await secureStore.deleteItemAsync(token);
      assert(await secureStore.getItemAsync(token) === null, "Delete failed");
    } finally { await secureStore.deleteItemAsync(token); }
  });
  await check("Expo SecureStore: unsupported options never silently weaken a request", async () => {
    let rejected = false;
    try { await secureStore.setItemAsync(token, "unused", { requireAuthentication: true } as never); }
    catch (error) { rejected = (error as { code?: string }).code === "E_UNSUPPORTED_OPTION"; }
    assert(rejected, "Authentication option was silently ignored");
    assert(await secureStore.getItemAsync(token) === null, "Rejected request wrote data");
  });
  await check("Expo Linking: initial URL and scheme resolution", async () => {
    const initial = await links.getInitialURL();
    if (expectedInitial !== undefined) assert(initial === expectedInitial, `Initial URL mismatch: ${initial}`);
    assert(await links.getInitialURL() === initial, "Initial URL changed between reads");
    assert(await links.canOpenURL("https://example.com"), "HTTPS handler missing");
    assert(!await links.canOpenURL("legend-api-unknown://missing"), "Unknown scheme resolved");
  });
  if (driver) await check("Expo Linking: live URL events, file separation, removal and stable initial URL", async () => {
    const initial = await links.getInitialURL();
    const received: string[] = [], legacyFiles: string[] = [];
    const legacy = await links.onOpen(event => { if (event.type === "openFile") legacyFiles.push(event.url); });
    const sub = links.addEventListener("url", event => received.push(event.url));
    const warm = `legend-api-test://${token}/warm`;
    try {
      if (expectedInitial !== undefined) {
        const opened = `legend-api-test://${token}/opened`;
        assert(await links.openURL(opened) === true, "openURL must resolve true");
        await until(() => received.includes(opened));
        received.length = 0;
      }
      await native("openURLs", { urls: [warm, "file:///tmp/legend-api-fixture.txt"] });
      await until(() => received.includes(warm) && legacyFiles.includes("file:///tmp/legend-api-fixture.txt"));
      assert(received.length === 1, "URL listener received file/duplicate event");
      assert(await links.getInitialURL() === initial, "Warm URL replaced launch URL");
      sub.remove(); sub.remove();
      await native("openURLs", { urls: [`legend-api-test://${token}/removed`] });
      await delay(100);
      assert(received.length === 1, "Removed listener still active");
      const late: string[] = [];
      const later = links.addEventListener("url", event => late.push(event.url));
      try { await delay(100); assert(late.length === 0, "Live listener replayed historical URLs"); }
      finally { later.remove(); }
    } finally { sub.remove(); legacy.remove(); }
  });
}
