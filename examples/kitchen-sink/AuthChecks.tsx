import { useEffect } from "react";
import { Text } from "react-native";
import { createAuthSession, digestStringAsync, getRandomBytesAsync } from "@legendapp/spark/auth-session";
import * as files from "@legendapp/spark/files";
export function AuthChecks({ report, provider }: { report: string; provider: string }) {
  useEffect(() => {
    const timer = setTimeout(() => void (async () => {
      const results: { name: string; passed: boolean; error?: string }[] = [];
      const assert = (value: unknown, message: string) => { if (!value) throw new Error(message); };
      async function check(name: string, action: () => Promise<void>) { try { await action(); results.push({ name, passed: true }); } catch (error) { results.push({ name, passed: false, error: String(error) }); } }
      await check("OS random bytes and SHA-256 known vector", async () => {
        const a = await getRandomBytesAsync(32), b = await getRandomBytesAsync(32);
        assert(a.length === 32 && a.some((value, index) => value !== b[index]), "Secure random bytes failed");
        assert(await digestStringAsync("SHA-256", "abc") === "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad", "SHA-256 vector failed");
      });
      await check("system browser redirects to native loopback and callback listener closes", async () => {
        const session = await createAuthSession({ timeoutMs: 30000 });
        try {
          const uri = `${provider}?state=${session.state}&redirect_uri=${encodeURIComponent(session.redirectUri)}`;
          const result = await session.open(uri);
          assert(result.type === "success" && result.url.includes("code=local-test"), JSON.stringify(result));
          let open = false; try { await fetch(session.redirectUri); open = true; } catch {} assert(!open, "Callback listener survived completion");
        } finally { await session.dismiss(); }
      });
      await check("cancellation and timeout dispose prepared native listeners", async () => {
        const controller = new AbortController(); const session = await createAuthSession({ signal: controller.signal });
        controller.abort(); const cancelled = await session.open(`${provider}?state=${session.state}`);
        assert(cancelled.type === "cancel", JSON.stringify(cancelled));
        const expired = await createAuthSession({ timeoutMs: 50 }); await new Promise(resolve => setTimeout(resolve, 150));
        assert((await expired.open(`${provider}?state=${expired.state}`)).type === "timeout", "Timeout did not complete");
      });
      await files.writeText(report, JSON.stringify({ passed: results.every(result => result.passed), results }, null, 2));
    })().catch(error => void files.writeText(report, JSON.stringify({ passed: false, error: String(error) }))), 250);
    return () => clearTimeout(timer);
  }, [report, provider]);
  return <Text>Browser authentication native checks</Text>;
}
