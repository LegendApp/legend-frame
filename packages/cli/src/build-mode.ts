export function buildMode(values: { prebuilt?: unknown; go?: unknown; dev?: unknown; preview?: unknown; release?: unknown }) {
  const prebuilt = values.prebuilt || values.go;
  if ([prebuilt, values.dev, values.preview, values.release].filter(Boolean).length > 1) {
    throw new Error("Choose only one build mode: --dev, --preview, --release, or --prebuilt.");
  }
  return prebuilt ? "go" : values.dev ? "dev" : values.preview ? "preview" : "release";
}
