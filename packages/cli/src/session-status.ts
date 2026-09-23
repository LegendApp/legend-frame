export function sessionStatus(target: "go" | "dev", available: boolean, issues: string[], running = false, downloadable = false) {
  if (!available && target === "go" && !issues.length) return {
    compatible: false,
    canBuild: false,
    message: downloadable ? "Frame Runner is ready to download. Press d to install and open it." : "The Frame Runner isn’t installed for this SDK.\nInstall an SDK bundle containing a matching Frame Runner (node install.mjs), or register a Frame Runner with frame sdk register <runtime directory>.",
    actions: downloadable ? "d  Download and open Runner · g  Use development build · Ctrl+C  Exit" : "g  Use development build · Ctrl+C  Exit",
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
    message: `● ${running ? "Running in " : "Ready to open "}${target === "go" ? "Frame Runner" : "development build"}\n  Fast Refresh enabled`,
    actions: "d  Open desktop · r  Reload · j  Debugger\ng  Change desktop runtime · Ctrl+C  Exit",
  };
}
