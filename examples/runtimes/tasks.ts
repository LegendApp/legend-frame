import { runtimeFunction, getCurrentRuntime } from "@react-native-runtimes/core";
import stableStringify from "fast-json-stable-stringify";

let calls = 0;
export const identify = runtimeFunction(() => ({ ...getCurrentRuntime(), calls: ++calls }));
export const heavy = runtimeFunction((milliseconds: number) => {
  const started = Date.now();
  let iterations = 0, checksum = 0;
  do {
    const text = stableStringify({ z: iterations, a: [1, 2, 3], nested: { b: true, a: "desktop" } });
    for (let i = 0; i < text.length; i++) checksum = (Math.imul(checksum, 31) + text.charCodeAt(i)) | 0;
    iterations++;
  } while (Date.now() - started < milliseconds);
  return { ...getCurrentRuntime(), iterations, checksum, elapsedMs: Date.now() - started };
});
export const echo = runtimeFunction(async (value: { message: string; count: number }) => {
  await new Promise(resolve => setTimeout(resolve, 30));
  return { ...getCurrentRuntime(), value };
});
export const fail = runtimeFunction(() => { throw new Error("Intentional worker error"); });
export const readNativeFile = runtimeFunction(async (file: string) => {
  const { readText } = require("@legendapp/frame/files");
  return await readText(file);
});
