import { spawnProcess } from "../packages/cli/src/process.ts";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { run } from "../packages/cli/src/commands.ts";
import { readJson, VERSION } from "../packages/cli/src/project.ts";

const root = path.resolve(import.meta.dirname, "..");
const folder = path.join(root, "artifacts/releases", VERSION);
const release = readJson(path.join(folder, "release.json"));
const revision = (await run(root, ["git", "rev-parse", "HEAD"], { capture: true })).trim();
if (release.version !== VERSION || release.revision !== revision || (await run(root, ["git", "status", "--porcelain"], { capture: true })).trim()) throw new Error("Publishing requires the clean source revision used to assemble this release.");
for (const [name, hash] of Object.entries(release.sha256)) {
  if (path.basename(name) !== name || createHash("sha256").update(readFileSync(path.join(folder, name))).digest("hex") !== hash) throw new Error(`Release artifact changed: ${name}`);
}
if (!release.sha256[release.npm] || !release.sha256["runner-manifest.json"]) throw new Error("Incomplete release artifact manifest");
const repo = "LegendApp/legend-spark", tag = `v${VERSION}`;
const repository = JSON.parse(await run(root, ["gh", "repo", "view", repo, "--json", "visibility"], { capture: true }));
if (repository.visibility !== "PUBLIC") throw new Error("Runner downloads require a public distribution repository. Do not publish npm while release assets are private.");
await run(root, ["gh", "auth", "status"]);
await run(root, ["npm", "whoami"]);
const ref = JSON.parse(await run(root, ["gh", "api", `repos/${repo}/git/ref/tags/${tag}`], { capture: true }));
let commit = ref.object;
if (commit.type === "tag") commit = JSON.parse(await run(root, ["gh", "api", `repos/${repo}/git/tags/${commit.sha}`], { capture: true })).object;
if (commit.type !== "commit" || commit.sha !== revision) throw new Error("Release tag does not point at the staged source revision");
// Never overwrite assets or move existing tags. A retry verifies the existing
// public release's commit and every asset before continuing to npm publication.
let existing: any;
try { existing = JSON.parse(await run(root, ["gh", "release", "view", tag, "--repo", repo, "--json", "isDraft,assets"], { capture: true })); }
catch {
  await run(root, ["gh", "release", "create", tag, "--repo", repo, "--verify-tag", "--draft", "--prerelease", "--title", `Spark ${VERSION}`, "--notes", "Spark preview for macOS Apple Silicon. Requires Node 24.19.0 or newer. Runner downloads automatically on first desktop launch. Windows native acceptance remains pending."]);
  await run(root, ["gh", "release", "upload", tag, "--repo", repo, ...Object.keys(release.sha256).map(name => path.join(folder, name)), path.join(folder, "checksums.txt"), path.join(folder, "release.json")]);
  existing = { isDraft: true };
}
// Read authenticated GitHub assets while draft; verify bytes before making URLs public.
const releases = JSON.parse(await run(root, ["gh", "api", `repos/${repo}/releases`, "--paginate", "--slurp"], { capture: true })).flat();
const uploaded = releases.find((item: any) => item.tag_name === tag);
if (!uploaded) throw new Error("Uploaded release could not be found");
let assets = uploaded.assets;
if (uploaded.draft) {
  const missing = [...Object.keys(release.sha256), "checksums.txt", "release.json"].filter(name => !assets.some((asset: any) => asset.name === name));
  if (missing.length) {
    await run(root, ["gh", "release", "upload", tag, "--repo", repo, ...missing.map(name => path.join(folder, name))]);
    assets = JSON.parse(await run(root, ["gh", "api", `repos/${repo}/releases/${uploaded.id}`], { capture: true })).assets;
  }
}
for (const [name, expected] of Object.entries(release.sha256)) {
  const asset = assets.find((item: any) => item.name === name);
  if (!asset || asset.digest !== `sha256:${expected}`) throw new Error(`GitHub asset is missing or has a different digest: ${name}. Preserve the release and repair the upload explicitly.`);
}
if (existing.isDraft) await run(root, ["gh", "release", "edit", tag, "--repo", repo, "--draft=false", "--prerelease"]);
// npm web authentication needs the terminal; piping output disables its prompt.
const publish = spawnProcess(["npm", "publish", path.join(folder, release.npm), "--access", "public", "--tag", "next"], { cwd: root, stdin: "inherit", stdout: "inherit", stderr: "inherit" });
const publishCode = await publish.exited;
if (publishCode) throw new Error(`npm publish exited ${publishCode}`);
console.log(`Published ${tag}. Run clean-machine acceptance with npx @legendapp/spark@next create MyApp before promoting latest.`);
