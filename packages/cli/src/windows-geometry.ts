import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const base = "::Microsoft::ReactNative::Composition::Experimental::IComponentViewInterop>";
export function patchWindowsGeometry(source: string) {
  if (source.includes("// LEGEND GEOMETRY ABI")) return source;
  if (!source.includes(base) || !source.includes("  virtual RECT getClientRect() const noexcept;")) throw new Error("The pinned RNW ComponentView changed; review the Legend geometry adapter before upgrading");
  return source.replace('#include <ComponentView.Experimental.interop.h>', '#include <ComponentView.Experimental.interop.h>\n#include <LegendComponentGeometry.h>')
    .replace(base, "::Microsoft::ReactNative::Composition::Experimental::IComponentViewInterop, ::ILegendComponentGeometry>")
    .replace("  virtual RECT getClientRect() const noexcept;", `  virtual RECT getClientRect() const noexcept;
  // LEGEND GEOMETRY ABI
  RECT __stdcall LegendClientRect() noexcept override { return getClientRect(); }
  int64_t __stdcall LegendHitTest(float x, float y, float *localX, float *localY) noexcept override {
    facebook::react::Point local;
    const auto tag = hitTest({x, y}, local);
    *localX = local.x; *localY = local.y; return tag;
  }`);
}
export function prepareWindowsGeometry(root: string) {
  const req = createRequire(path.join(root, "package.json"));
  const manifest = req.resolve("react-native-windows/package.json");
  if (JSON.parse(readFileSync(manifest, "utf8")).version !== "0.81.35") throw new Error("Legend's Windows geometry adapter requires react-native-windows 0.81.35");
  const rnw = path.dirname(manifest), source = path.join(rnw, "Microsoft.ReactNative/Fabric/ComponentView.h");
  const original = readFileSync(source, "utf8"); const patched = patchWindowsGeometry(original);
  if (patched !== original) writeFileSync(source, patched);
  const header = readFileSync(req.resolve("@legend-apps/desktop-host/windows/LegendComponentGeometry.h"), "utf8");
  writeFileSync(path.join(rnw, "Microsoft.ReactNative.Cxx/LegendComponentGeometry.h"), header);
}
