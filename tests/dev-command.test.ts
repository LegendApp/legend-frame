import { expect, test } from "bun:test";
import { devArguments, devTargets } from "../packages/cli/src/dev-command";

test("dev consumes Legend options and forwards Expo flags and aliases unchanged", () => {
  const expo = ["--go", "--clear", "--offline", "-p", "8123", "--max-workers=2", "-w", "--scheme", "my-app", "--future-expo-flag"];
  expect(devArguments(["--project", "/tmp/My App", ...expo, "--platform=ios", "--go-binary=/tmp/Go=1.app", "--no-open"])).toEqual({
    project: "/tmp/My App", platform: "ios", goBinary: "/tmp/Go=1.app", noOpen: true, expo,
  });
  expect(devArguments(["-g", "-c", "-m", "lan"])).toEqual({ expo: ["-g", "-c", "-m", "lan"] });
  for (const args of [["--go-binary"], ["--platform", "--clear"], ["--project="], ["--no-open=false"]]) expect(() => devArguments(args)).toThrow();
});

test("initial mobile launch keeps host desktop actions available", () => {
  const platforms = ["ios", "android", "web", "macos", "windows"];
  expect(devTargets(platforms, "ios", "macos")).toEqual({ initial: "ios", desktop: "macos" });
  expect(devTargets(platforms, "web", "windows")).toEqual({ initial: "web", desktop: "windows" });
  expect(devTargets(platforms, "windows", "macos")).toEqual({ initial: "windows", desktop: "windows" });
  expect(devTargets(["ios", "android", "web"], "android")).toEqual({ initial: "android", desktop: undefined });
  expect(() => devTargets(["macos"], "ios")).toThrow("not supported");
});
