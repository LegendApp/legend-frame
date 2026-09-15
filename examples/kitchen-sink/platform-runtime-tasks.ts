import { getCurrentRuntime, runtimeFunction } from "@react-native-runtimes/core";
let count = 0;
export const runtimeProbe = runtimeFunction(async (increment: number) => {
  await new Promise(resolve => setTimeout(resolve, 10));
  count += increment;
  const runtime = getCurrentRuntime();
  return { count, main: runtime.isMain, name: runtime.name, hermes: !!(globalThis as any).HermesInternal };
});
export const runtimeFailure = runtimeFunction(() => { throw new Error("contract-worker-error"); });
