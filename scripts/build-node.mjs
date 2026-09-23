import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export function buildCLI(root = path.resolve(import.meta.dirname, "..")) {
  const source = path.join(root, "packages/cli/src");
  const output = path.join(root, "packages/cli/dist");
  rmSync(output, { recursive: true, force: true });
  function visit(relative) {
    const directory = path.join(source, relative);
    mkdirSync(path.join(output, relative), { recursive: true });
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const name = path.join(relative, entry.name);
      if (entry.isDirectory()) visit(name);
      else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
        const result = ts.transpileModule(readFileSync(path.join(source, name), "utf8"), {
          fileName: name,
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, rewriteRelativeImportExtensions: true, verbatimModuleSyntax: true },
          reportDiagnostics: true,
        });
        const errors = result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error) ?? [];
        if (errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(errors, { getCanonicalFileName: f => f, getCurrentDirectory: () => root, getNewLine: () => "\n" }));
        writeFileSync(path.join(output, name.replace(/\.ts$/, ".js")), result.outputText);
      } else cpSync(path.join(source, name), path.join(output, name));
    }
  }
  visit("");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildCLI();
