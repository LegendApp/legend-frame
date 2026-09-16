import { getAppContext, quit } from "@legend-apps/desktop/app";
import { Platform } from "react-native";
import { toByteArray } from "base64-js";
import { spawn, runCommand } from "@legend-apps/desktop/processes";
import * as windows from "@legend-apps/desktop/windows";
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export async function runSidecarChecks() {
  const results: { name: string; passed: boolean; error?: string }[] = [];
  async function check(name: string, action: () => Promise<void>) {
    try { await action(); results.push({ name, passed: true }); }
    catch (error) { results.push({ name, passed: false, error: String(error) }); }
  }
  await check("packaged helper resolves and preserves Unicode stdin/stdout", async () => {
    const result = await runCommand({ executable: "helper:echo", input: "hello 🦀\n", timeoutMs: 5000 });
    assert(result.exitCode === 0 && result.stdout === "hello 🦀\n" && result.stderr === "ready\n", JSON.stringify(result));
  });
  await check("missing helper rejects and helper failure preserves exit status", async () => {
    let failed = false;
    try { await spawn({ executable: "helper:missing" }); } catch { failed = true; }
    assert(failed, "Missing helper succeeded");
    const result = await runCommand({ executable: "helper:echo", args: ["--fail"], timeoutMs: 5000 });
    assert(result.exitCode === 7 && result.stderr.includes("requested failure"), JSON.stringify(result));
  });
  await check("binary streaming remains complete beyond the capture limit", async () => {
    let received = 0, valid = true;
    const child = await spawn({ executable: "helper:echo", args: ["--binary"], timeoutMs: 15000 }, chunk => {
      if (chunk.stream !== "stdout") return;
      for (const byte of toByteArray(chunk.base64)) { if (byte !== received % 256) valid = false; received++; }
    });
    await child.closeInput();
    const result = await child.exited;
    assert(valid && received === 9 * 1024 * 1024 && result.outputTruncated && toByteArray(result.stdoutBase64).length === 8 * 1024 * 1024, `Binary stream: ${received}, valid=${valid}, truncated=${result.outputTruncated}`);
  });
  await check("closing a secondary window does not terminate an app-owned helper", async () => {
    const child = await spawn({ executable: "helper:echo", timeoutMs: 5000 });
    try {
      await windows.openWindow({ id: "sidecar-owner-probe", width: 400, height: 300 });
      await windows.closeWindow("sidecar-owner-probe");
      await child.write("still alive"); await child.closeInput();
      assert((await child.exited).stdout === "still alive", "Window close terminated helper");
    } finally { await child.terminate(); }
  });
  await check("timeout terminates blocked input and repeated termination is safe", async () => {
    const child = await spawn({ executable: "helper:echo", timeoutMs: 100 });
    assert((await child.exited).timedOut, "Missing timeout result");
    await child.terminate(); await child.closeInput();
  });
  if (Platform.OS === "macos") await check("root exit and cancellation clean up descendants holding pipes", async () => {
    for (const script of ["sleep 30 & exit 0", "sleep 30 & wait"]) {
      const result = await runCommand({ executable: "/bin/sh", args: ["-c", script], timeoutMs: 200 });
      assert(script.endsWith("exit 0") ? result.exitCode === 0 : result.timedOut, "Wrong descendant exit result");
    }
  });
  let livePid: number | undefined;
  if ((await getAppContext()).launchArguments.includes("--legend-sidecar-quit-probe")) {
    await check("live helper is ready for external app-quit cleanup verification", async () => {
      let text = "";
      await spawn({ executable: "helper:echo", args: ["--identity"] }, chunk => {
        if (chunk.stream === "stdout") text += String.fromCharCode(...toByteArray(chunk.base64));
      });
      const deadline = Date.now() + 3000;
      while (!text.includes("\n") && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 20));
      livePid = Number(text.trim()); assert(livePid > 0, "Missing live helper PID");
    });
    setTimeout(() => void quit(), 1000);
  }
  return { livePid, passed: results.every(result => result.passed), results };
}
