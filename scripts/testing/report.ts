import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { catalog, initialResults, summarize, updateResult, type CaseResult, type TestPlatform } from "../../examples/kitchen-sink/contract-report";
export interface TestReport {
  schema: "spark-platform-tests/v1";
  runId: string;
  source: { commit: string; dirty: boolean; fingerprint: string };
  target: { platform: TestPlatform; arch: string; device: string; mode: string };
  host: { platform: string; arch: string };
  versions: Record<string, string>;
  runtime?: unknown;
  error?: string;
  scope: "prepare" | "runtime";
  execution: "running" | "completed" | "failed" | "blocked";
  startedAt: string;
  finishedAt?: string;
  project: string;
  results: CaseResult[];
  summary: ReturnType<typeof summarize>;
}
export function sourceIdentity(root: string): TestReport["source"] {
  function git(args: string[]) {
    const result = Bun.spawnSync(["git", ...args], { cwd: root });
    if (result.exitCode !== 0) throw new Error(result.stderr.toString());
    return result.stdout.toString();
  }
  const hash = createHash("sha256");
  const files = git(["ls-files", "--cached", "--others", "--exclude-standard", "-z"]).split("\0").filter(Boolean).sort();
  for (const file of new Set(files)) { hash.update(file + "\0"); hash.update(existsSync(path.join(root, file)) ? readFileSync(path.join(root, file)) : "<deleted>"); }
  return { commit: git(["rev-parse", "HEAD"]).trim(), dirty: !!git(["status", "--porcelain"]).trim(), fingerprint: hash.digest("hex") };
}
export function createReport(root: string, project: string, target: TestReport["target"], scope: TestReport["scope"]): TestReport {
  const results = initialResults(target.platform);
  return { schema: "spark-platform-tests/v1", runId: crypto.randomUUID(), source: sourceIdentity(root), target,
    host: { platform: process.platform, arch: process.arch }, versions: {}, scope, execution: "running", startedAt: new Date().toISOString(), project, results, summary: summarize(results) };
}
export function record(report: TestReport, result: CaseResult) {
  const definition = catalog.find(c => c.id === result.id);
  if (!definition) throw new Error(`Unknown case ${result.id}`);
  if (report.scope === "prepare" && !["build.project", "build.bundle"].includes(result.id) && result.status === "passed") throw new Error("Preparation cannot prove runtime behavior");
  if (definition.support[report.target.platform] !== "implemented" && result.status === "passed") throw new Error(`Case ${result.id} is outside implemented support; update the contract before claiming a pass`);
  if (result.status === "not-applicable" && definition.support[report.target.platform] !== "not-applicable") throw new Error(`Case ${result.id} cannot be marked not applicable`);
  if (result.status === "missing-implementation" && definition.support[report.target.platform] !== "missing") throw new Error(`Case ${result.id} has an implementation; an unavailable backend is a failure`);
  if (report.results.find(c => c.id === result.id)?.status === "failed") return;
  report.results = updateResult(report.results, result); report.summary = summarize(report.results);
}
export function installedVersions(root: string): Record<string, string> {
  const versions: Record<string, string> = {};
  for (const name of ["expo", "expo-desktop", "react-native", "react-native-macos", "react-native-windows", "@expo/ui"]) {
    const file = path.join(root, "node_modules", name, "package.json");
    if (existsSync(file)) versions[name] = JSON.parse(readFileSync(file, "utf8")).version;
  }
  return versions;
}
export function saveReport(file: string, report: TestReport) {
  report.summary = summarize(report.results);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(`${file}.pending`, JSON.stringify(report, null, 2) + "\n"); renameSync(`${file}.pending`, file);
}
export function validateReport(value: unknown): asserts value is TestReport {
  const r = value as TestReport;
  if (!r || r.schema !== "spark-platform-tests/v1" || !r.runId || !r.source?.commit || !r.source.fingerprint || !r.target || !["running", "completed", "failed", "blocked"].includes(r.execution) || !["prepare", "runtime"].includes(r.scope) || !Array.isArray(r.results)) throw new Error("Invalid platform test report");
  if (!catalog[0]!.support[r.target.platform]) throw new Error("Invalid report platform");
  const ids = new Set<string>();
  for (const result of r.results) {
    if (ids.has(result.id) || !catalog.some(c => c.id === result.id) || !["passed", "failed", "not-tested", "not-applicable", "missing-implementation"].includes(result.status)) throw new Error(`Invalid/duplicate result ${result.id}`);
    ids.add(result.id);
    if (result.status === "passed") {
      const c = catalog.find(c => c.id === result.id)!;
      if (c.support[r.target.platform] !== "implemented" || (r.scope === "prepare" && !["build.project", "build.bundle"].includes(result.id))) throw new Error(`Invalid execution claim for ${result.id}`);
    }
  }
  if (ids.size !== catalog.length) throw new Error("Incomplete case inventory; regenerate using the current test catalog");
}
const escape = (s: string) => s.replaceAll("|", "\\|").replaceAll("\n", " ");
export function renderReports(reports: TestReport[]) {
  const groups = new Map<string, TestReport[]>();
  for (const report of reports) {
    validateReport(report);
    const key = `${report.source.commit}:${report.source.fingerprint}`;
    groups.set(key, [...groups.get(key) ?? [], report]);
  }
  let output = "# Platform test coverage\n\nEach column is one run. Missing evidence stays visible; runs from different source trees are never combined. A passing bundle is not native acceptance.\n";
  for (const runs of groups.values()) {
    const source = runs[0]!.source;
    output += `\n## ${source.commit.slice(0, 12)}${source.dirty ? " (working tree changes)" : ""} — source ${source.fingerprint.slice(0, 12)}\n\n`;
    runs.forEach((r, i) => { output += `${i + 1}. ${escape(r.target.platform)}/${escape(r.target.arch)} · ${escape(r.target.device)} · ${escape(r.target.mode)} · ${r.scope} · ${r.execution} · ${r.finishedAt ?? "unfinished"} · run ${r.runId}\n`; });
    output += `\n| Case | ${runs.map((_, i) => `Run ${i + 1}`).join(" | ")} |\n| --- | ${runs.map(() => "---").join(" | ")} |\n`;
    for (const c of catalog) output += `| ${escape(c.title)} | ${runs.map(r => r.results.find(x => x.id === c.id)!.status).join(" | ")} |\n`;
    runs.forEach((r, i) => {
      output += `\n### Run ${i + 1} details\n\n`;
      if (r.error) output += `Run failure: ${escape(r.error)}\n\n`;
      output += `Versions: ${escape(JSON.stringify(r.versions))}\n\n`;
      for (const result of r.results.filter(x => x.status === "failed" || (x.status === "not-tested" && x.detail !== "No execution evidence in this run"))) output += `- ${result.id}: ${escape(result.detail ?? result.status)}\n`;
      const s = summarize(r.results); output += `\n${Object.entries(s.counts).map(([k, v]) => `${v} ${k}`).join(", ")}. Coverage ${s.complete ? "complete" : "incomplete"}.\n`;
    });
  }
  return output;
}

/** Validate the whole message before updating coverage; a stale/mismatched app
 * must not contribute partial passes before its identity is rejected. */
export function acceptRuntimeMessage(report: TestReport, message: any, allowedCases: ReadonlySet<string>, expectedFingerprint?: string): boolean {
  if (report.scope !== "runtime" || message?.runId !== report.runId || message.runtime?.platform !== report.target.platform || !Array.isArray(message.results)) throw new Error("Report came from the wrong run, scope or platform");
  const desktop = ["macos", "windows"].includes(report.target.platform);
  if (report.target.platform !== "web" && !message.runtime.hermes) throw new Error("Expected Hermes execution");
  if (desktop && (!expectedFingerprint || message.runtime.native?.platform !== report.target.platform || message.runtime.native?.arch !== report.target.arch || message.runtime.native?.mode !== report.target.mode || message.runtime.native?.fingerprint !== expectedFingerprint)) throw new Error("Native runtime identity does not match the build");
  const pending = { ...report, results: [...report.results] };
  const seen = new Set<string>();
  for (const result of message.results) {
    if (!result || typeof result.id !== "string" || seen.has(result.id) || !["passed", "failed", "not-tested", "not-applicable", "missing-implementation"].includes(result.status)) throw new Error("Invalid or duplicate app result");
    seen.add(result.id);
    if (allowedCases.has(result.id)) record(pending, result);
    else if (result.status === "passed" || result.status === "failed") throw new Error(`App cannot attest case ${result.id}`);
  }
  pending.runtime = message.runtime;
  record(pending, { id: "runtime.launch", status: "passed", evidence: "Live app report with matching platform and runtime identity" });
  Object.assign(report, pending);
  return message.complete === true;
}
