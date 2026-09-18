import { test, expect } from "bun:test";
import { patchWindowsGeometry } from "../packages/cli/src/windows-geometry";
test("RNW geometry extension is idempotent and leaves existing interface ABI intact", () => {
  const original = '#include <ComponentView.Experimental.interop.h>\nstruct ComponentView : public ComponentViewT<ComponentView, ::Microsoft::ReactNative::Composition::Experimental::IComponentViewInterop> {\n  virtual RECT getClientRect() const noexcept;\n};';
  const patched = patchWindowsGeometry(original);
  expect(patched).toContain("IComponentViewInterop, ::IFrameComponentGeometry>");
  expect(patched).toContain("const auto tag = hitTest({x, y}, local)");
  expect(patchWindowsGeometry(patched)).toBe(patched);
  expect(() => patchWindowsGeometry("upstream changed")).toThrow("pinned RNW");
});
