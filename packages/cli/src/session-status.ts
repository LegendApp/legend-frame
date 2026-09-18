export function sessionStatus(target: "go" | "dev", available: boolean, issues: string[], running = false) {
  if (!available && target === "go" && !issues.length) return {
    compatible: false,
    canBuild: false,
    message: "The prebuilt runtime isn’t installed for this SDK.\nInstall an SDK bundle containing a matching prebuilt runtime (bun install.ts), or register a prebuilt runtime with frame sdk register <runtime directory>.",
    actions: "g  Use development build · Ctrl+C  Exit",
  };
  if (issues.length || !available) return {
    compatible: false,
    canBuild: true,
    message: `${target === "dev" && available ? "The development build needs rebuilding." : "A development build is needed."}${issues.length ? "\n" + issues.join("\n") : ""}`,
    actions: `b  ${target === "dev" && available ? "Rebuild" : "Build"} and open · g  Change desktop runtime · Ctrl+C  Exit`,
  };
  return {
    compatible: true,
    canBuild: false,
    message: `● ${running ? "Running in " : "Ready to open "}${target === "go" ? "prebuilt runtime" : "development build"}\n  Fast Refresh enabled`,
    actions: "d  Open desktop · r  Reload · j  Debugger\ng  Change desktop runtime · Ctrl+C  Exit",
  };
}
