import { existsSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { run } from "./commands.ts";
import { readJson, stateFile, writeJson } from "./project.ts";

export type SigningIdentity = { hash: string; name: string; teamId: string };
export type SigningCredentials = SigningIdentity & { keychainProfile: string; keychain?: string };
export type Runner = typeof run;

export function parseIdentities(output: string): SigningIdentity[] {
  return [...output.matchAll(/\b([A-Fa-f0-9]{40})\s+"(Developer ID Application: [^"\n]+ \(([A-Z0-9]{10})\))"/g)]
    .map((match) => ({ hash: match[1]!.toUpperCase(), name: match[2]!, teamId: match[3]! }));
}

export function chooseIdentity(identities: SigningIdentity[], identity?: string, teamId?: string) {
  const matches = identities.filter((item) => (!identity || item.hash === identity.toUpperCase() || item.name === identity) && (!teamId || item.teamId === teamId));
  if (!matches.length) throw new Error("No matching Developer ID Application identity with a private key is available. Install it through Xcode or Keychain Access, then run legend credentials.");
  return matches;
}

export function notaryAuth(credentials: SigningCredentials) {
  return ["--keychain-profile", credentials.keychainProfile, ...(credentials.keychain ? ["--keychain", credentials.keychain] : [])];
}

async function ask(question: string) {
  const input = createInterface({ input: process.stdin, output: process.stdout });
  try { return (await input.question(question)).trim(); }
  finally { input.close(); }
}

export async function credentials(root: string, reset = false, execute: Runner = run): Promise<SigningCredentials> {
  const file = stateFile(root, "signing.json");
  const saved = !reset && existsSync(file) ? readJson(file) : {};
  const config = readJson(path.join(root, "app.json")).expo?.extra?.legend?.signing?.macos ?? {};
  const keychain = process.env.LEGEND_SIGNING_KEYCHAIN ?? saved.keychain;
  const identity = process.env.LEGEND_DEVELOPER_ID_APPLICATION ?? config.identity ?? saved.hash;
  const teamId = process.env.LEGEND_TEAM_ID ?? config.teamId ?? saved.teamId;
  const discovered = parseIdentities(await execute(root, ["security", "find-identity", "-v", "-p", "codesigning", ...(keychain ? [keychain] : [])], { capture: true }));
  const matches = chooseIdentity(discovered, identity, teamId);
  let selected = matches[0]!;
  if (matches.length > 1) {
    if (!process.stdin.isTTY) throw new Error("Multiple signing identities are available. Set LEGEND_DEVELOPER_ID_APPLICATION or run legend credentials interactively.");
    console.log(matches.map((item, index) => `${index + 1}. ${item.name} [${item.hash}]`).join("\n"));
    const choice = Number(await ask("Signing identity: "));
    if (!Number.isInteger(choice) || choice < 1 || choice > matches.length) throw new Error("Invalid signing identity selection.");
    selected = matches[choice - 1]!;
  }
  let keychainProfile = process.env.LEGEND_NOTARY_KEYCHAIN_PROFILE ?? saved.keychainProfile;
  if (!keychainProfile) {
    if (!process.stdin.isTTY) throw new Error("Notarization is not configured. Set LEGEND_NOTARY_KEYCHAIN_PROFILE or run legend credentials interactively.");
    keychainProfile = await ask("Existing notarization Keychain profile (Enter to create one): ");
    if (!keychainProfile) {
      keychainProfile = `legend-${selected.teamId}`;
      console.log(`Apple’s tool will store and validate notarization credentials in Keychain as ${keychainProfile}. Secret input is handled by notarytool and is not recorded by Legend.`);
      const child = Bun.spawn(["xcrun", "notarytool", "store-credentials", keychainProfile, ...(keychain ? ["--keychain", keychain] : [])], {
        stdin: "inherit", stdout: "inherit", stderr: "inherit",
      });
      if (await child.exited) throw new Error("Notarization credential setup failed. Run legend credentials to retry.");
    }
  }
  const result: SigningCredentials = { ...selected, keychainProfile, ...(keychain ? { keychain } : {}) };
  // Validate the Keychain profile before native compilation or signing.
  await execute(root, ["xcrun", "notarytool", "history", ...notaryAuth(result), "--output-format", "json"], { capture: true });
  writeJson(file, result);
  return result;
}
