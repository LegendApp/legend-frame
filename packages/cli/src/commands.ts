import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { stateFile } from "./project.ts";

const running = new Map<string, Set<ReturnType<typeof Bun.spawn>>>();
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
  } = {},
) {
  mkdirSync(stateFile(root, "logs"), { recursive: true });
  appendFileSync(
    stateFile(root, "commands.jsonl"),
    JSON.stringify({
      time: new Date().toISOString(),
      argv,
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
    `logs/${Date.now()}-${path.basename(argv[0]!)}.log`,
  );
  async function consume(
    stream: ReadableStream<Uint8Array>,
    target: NodeJS.WriteStream,
  ) {
    for await (const chunk of stream) {
      const value = new TextDecoder().decode(chunk);
      output += value;
      appendFileSync(log, value);
      if (!options.capture) target.write(value);
    }
  }
  await Promise.all([
    consume(child.stdout, process.stdout),
    consume(child.stderr, process.stderr),
  ]);
  const code = await child.exited;
  running.get(root)!.delete(child);
  if (code)
    throw new Error(
      `${argv.join(" ")} exited ${code}. See ${log}\n${output.slice(-1800)}`,
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
