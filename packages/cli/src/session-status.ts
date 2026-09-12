export function sessionStatus(target: "go" | "dev", available: boolean, issues: string[], running = false) {
  if (!available && target === "go" && !issues.length) return {
    compatible: false,
    canBuild: false,
    message: "Legend Go isn’t installed for this SDK.\nAsk the SDK maintainer to run legend sdk build-go or legend sdk register <runtime directory>.\nPublic runtime downloads are not available yet.",
    actions: "s  Use development build · q  Quit",
  };
  if (issues.length || !available) return {
    compatible: false,
    canBuild: true,
    message: `${target === "dev" && available ? "The development build needs rebuilding." : "A development build is needed."}${issues.length ? "\n" + issues.join("\n") : ""}`,
    actions: `b  ${target === "dev" && available ? "Rebuild" : "Build"} and open · s  Change runtime · q  Quit`,
  };
  return {
    compatible: true,
    canBuild: false,
    message: `● ${running ? "Running in " : "Ready to open "}${target === "go" ? "Legend Go" : "development build"}\n  Fast Refresh enabled`,
    actions: "o  Open app · r  Reload · j  Debugger\ns  Change runtime · q  Quit",
  };
}
