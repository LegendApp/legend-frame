import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { stateFile } from "./project.ts";

const running = new Map<string, Set<ReturnType<typeof Bun.spawn>>>();
const secretFlags = new Set(["--password", "--apple-id-password", "--token", "--secret", "--api-key", "-P"]);
export function commandRedactor(argv: string[], secrets: string[] = []) {
  const values = [...secrets];
  for (let i = 0; i < argv.length; i++) {
    const [flag, ...inline] = argv[i]!.split("=");
    if (secretFlags.has(flag!)) values.push(inline.length ? inline.join("=") : argv[i + 1] ?? "");
  }
  const unique = [...new Set(values.filter(Boolean))].sort((a, b) => b.length - a.length);
  return { sensitive: unique.length > 0, redact: (value: string) => unique.reduce((text, secret) => text.replaceAll(secret, "[REDACTED]"), value) };
}
export function cancelCommands(root: string) {
  for (const child of running.get(root) ?? []) child.kill();
}

export async function run(
  root: string,
  argv: string[],
  options: {
    cwd?: string;
    env?: Record<string, string>;
    capture?: boolean;
    sensitiveValues?: string[];
  } = {},
) {
  const { sensitive, redact } = commandRedactor(argv, options.sensitiveValues);
  mkdirSync(stateFile(root, "logs"), { recursive: true });
  appendFileSync(
    stateFile(root, "commands.jsonl"),
    JSON.stringify({
      time: new Date().toISOString(),
      argv: argv.map(redact),
      cwd: options.cwd ?? root,
    }) + "\n",
  );
  const child = Bun.spawn(argv, {
    cwd: options.cwd ?? root,
    env: { ...process.env, ...options.env },
    stdout: "pipe",
    stderr: "pipe",
  });
  if (!running.has(root)) running.set(root, new Set());
  running.get(root)!.add(child);
  let output = "";
  const log = stateFile(
    root,
    `logs/${Date.now()}-${crypto.randomUUID()}-${path.basename(argv[0]!)}.log`,
  );
  async function consume(
    stream: ReadableStream<Uint8Array>,
    target: NodeJS.WriteStream,
  ) {
    for await (const chunk of stream) {
      const value = new TextDecoder().decode(chunk);
      output += value;
      if (!sensitive) {
        appendFileSync(log, value);
        if (!options.capture) target.write(value);
      }
    }
  }
  await Promise.all([
    consume(child.stdout, process.stdout),
    consume(child.stderr, process.stderr),
  ]);
  const code = await child.exited;
  // Buffer sensitive commands so secrets split across output chunks cannot leak.
  if (sensitive) {
    appendFileSync(log, redact(output));
    if (!options.capture) process.stdout.write(redact(output));
  }
  running.get(root)!.delete(child);
  if (code)
    throw new Error(
      `${argv.map(redact).join(" ")} exited ${code}. See ${log}\n${redact(output).slice(-1800)}`,
    );
  return output;
}
export function binary(root: string, name: string) {
  return path.join(root, "node_modules", ".bin", name);
}
export async function doctor(root: string) {
  if (process.platform !== "darwin" || process.arch !== "arm64")
    throw new Error("The prototype supports Apple Silicon macOS only.");
  for (const tool of ["node", "bun", "pod", "xcodebuild"])
    if (!Bun.which(tool))
      throw new Error(
        `Missing ${tool}. Install the macOS native prerequisites described in docs/development.md, then retry the build.`,
      );
  await run(root, ["xcodebuild", "-version"], { capture: true });
  await run(root, ["xcrun", "--sdk", "macosx", "--show-sdk-path"], {
    capture: true,
  });
}
