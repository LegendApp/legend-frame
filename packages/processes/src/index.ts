import { Platform } from "react-native";
import Native from "./NativeDesktopProcesses";
import { onDesktopEvent } from "@legendapp/spark-desktop-app";
export type ProcessOptions = { executable: string; args?: string[]; cwd?: string; env?: Record<string, string>; timeoutMs?: number; input?: string };
export type ProcessOutput = { stream: "stdout" | "stderr"; base64: string };
export type ProcessResult = { exitCode: number; signal: boolean; stdout: string; stderr: string; stdoutBase64: string; stderrBase64: string; timedOut: boolean; outputTruncated: boolean };
let sequence = 0;
function absolute(value: string) { return Platform.OS === "windows" ? /^(?:[a-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)/i.test(value) : value.startsWith("/"); }
export async function spawn(options: ProcessOptions, onOutput?: (chunk: ProcessOutput) => void) {
  if (typeof options.executable !== "string" || (options.executable.startsWith("helper:") && !/^helper:[A-Za-z0-9_-]+$/.test(options.executable))) throw new Error("Invalid helper name or executable");
  if (options.input !== undefined && typeof options.input !== "string") throw new Error("input must be a string");
  if (!absolute(options.executable) && !options.executable.startsWith("helper:")) throw new Error("executable must be an absolute path or helper:name");
  if (options.executable.includes("\0") || options.args?.some(arg => typeof arg !== "string" || arg.includes("\0"))) throw new Error("Invalid process arguments");
  if (options.cwd !== undefined && (!absolute(options.cwd) || options.cwd.includes("\0"))) throw new Error("cwd must be absolute");
  if (options.env && Object.entries(options.env).some(([key, value]) => !key || /[=\0]/.test(key) || typeof value !== "string" || value.includes("\0"))) throw new Error("Invalid process environment");
  if (options.timeoutMs !== undefined && (!Number.isFinite(options.timeoutMs) || options.timeoutMs < 1)) throw new Error("timeoutMs must be positive");
  const id = `process-${Date.now()}-${++sequence}`;
  let finish!: (value: ProcessResult) => void;
  let ended = false;
  const exited = new Promise<ProcessResult>(resolve => { finish = resolve; });
  const subscription = onDesktopEvent(event => {
    if (event.processId !== id) return;
    if (event.type === "processOutput") onOutput?.({ stream: event.stream as "stdout" | "stderr", base64: event.base64 as string });
    if (event.type === "processExit") { ended = true; subscription.remove(); finish(event.result as ProcessResult); }
  });
  const call = async (method: string, args: object = {}) => { await Native.call(method, JSON.stringify({ id, ...args })); };
  try { await call("spawn", { ...options, streamOutput: !!onOutput }); } catch (error) { subscription.remove(); throw error; }
  return {
    id, exited,
    async write(text: string) { if (typeof text !== "string") throw new Error("Process input must be a string"); if (ended) throw new Error("Process has exited"); await call("write", { text }); },
    async closeInput() { if (!ended) await call("closeInput"); },
    async terminate() { if (!ended) await call("terminate"); },
  };
}
export async function runCommand(options: ProcessOptions) {
  const child = await spawn(options);
  await child.closeInput();
  return child.exited;
}
