export function buildMode(values: { go?: unknown; dev?: unknown; preview?: unknown; release?: unknown }) {
  if ([values.go, values.dev, values.preview, values.release].filter(Boolean).length > 1) {
    throw new Error("Choose only one build mode: --dev, --preview, --release, or --go.");
  }
  return values.go ? "go" : values.dev ? "dev" : values.preview ? "preview" : "release";
}
