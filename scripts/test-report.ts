import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { renderReports, validateReport, type TestReport } from "./testing/report.ts";
const { values, positionals } = parseArgs({ args: process.argv.slice(2), allowPositionals: true, options: { output: { type: "string" }, strict: { type: "boolean" } } });
const reports: TestReport[] = [];
function read(file: string) {
  if (statSync(file).isDirectory()) { for (const item of readdirSync(file)) if (item.endsWith(".json")) read(path.join(file, item)); return; }
  const report = JSON.parse(readFileSync(file, "utf8")); validateReport(report); reports.push(report);
}
for (const file of positionals.length ? positionals : [".spark/test-results"]) read(path.resolve(file));
if (!reports.length) throw new Error("No platform reports found");
const output = renderReports(reports);
if (values.output) { writeFileSync(path.resolve(values.output), output); console.log(`Report: ${path.resolve(values.output)}`); }
else console.log(output);
if (reports.some(r => !r.finishedAt || r.execution !== "completed" || r.results.some(c => c.status === "failed" || (values.strict && ["not-tested", "missing-implementation"].includes(c.status))))) process.exitCode = 1;
