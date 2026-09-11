# Prototype status

The local Apple Silicon prototype is implemented and its Go → custom development build → reduced standalone app flow was validated on 2026-09-10.

## Verified

| Check | Result |
| --- | --- |
| Install framework packages into external consumers | Passed with packed local tarballs, including a fresh starter after CLI fixes |
| Launch Hello World in a previously built Go runtime | Passed without prebuild, pods, codegen, or native compilation in the consumer |
| Relocated Go runtime | Launched while its original build directory was unavailable; saved artifacts passed signature verification |
| Native menus and dialogs in Go | Menu action updated React; file dialog opened and cancellation returned to React |
| Fast Refresh | JS style changes applied while preserving the menu result |
| JS-only dependency | `is-number` installed and rendered in Go without a native build |
| Detect an additional native dependency | Native greeting fixture triggered a custom-build message; latest server stopped Go and returned HTTP 409 for incompatible bundles |
| Switch to a custom build | Native generation, pods, codegen, Debug build, and launch completed; native greeting appeared |
| Reuse a compatible custom binary | CLI reported reuse without recompiling |
| Native source invalidation | Editing the fixture implementation triggered a rebuild and displayed the new native string |
| Reduced Debug build | Dialogs and greeting worked with native menus excluded |
| Standalone Release build | arm64 app launched with Metro stopped; native greeting and file dialog worked |
| Actual native pruning | Menu pod and generated bindings absent; final executable contains dialog/greeting classes and no menu class |
| Clean CNG | Two clean prebuild runs produced identical AppDelegate, Info.plist, Podfile, and Xcode-project hashes |
| Missing-tooling diagnostic | Isolated PATH test reported missing Xcode with retry guidance |
| CLI defaults | Fresh app created without package flags and opened with `bun dev`; automatic port fallback and separate missing-Go guidance verified |
| Custom build action | `b` reused a compatible custom binary and opened it; bare `build` reused the standalone release product |
| Focused tests / TypeScript | 14 tests passed; typecheck passed |

Local validation reports, production selection, clean generation hashes, and native build logs are saved in `docs/evidence/`. These generated diagnostics are not committed.

## Local artifacts

- Go runtime: `artifacts/runtimes/LegendGo.app`
- Standalone demonstration: `artifacts/demo/LegendHello.app`
- Framework package archives and manifest: `artifacts/packages/`
- External integration projects: `/tmp/LegendFrameworkGoProbe`, `/tmp/LegendFrameworkHello`, `/tmp/LegendFrameworkFreshSmoke`

Artifacts are ignored by Git and can be regenerated using the development instructions. Saved command logs in `docs/evidence/` remain available in the original development checkout.

## Integration fixes discovered

- Starter must include TypeScript tooling before Expo starts.
- Metro must run with watching enabled; Expo's CI mode disables normal reload/watch behavior.
- Dependency changes need a managed Metro restart and fresh app connection to avoid a stale dependency map. This can reset application state; ordinary JS edits still use Fast Refresh.
- An incompatible running app must be stopped because an existing HMR connection can push code without requesting a new bundle.
- RN's native packager websocket needs the selected `RCT_jsLocation` in addition to the JS bundle URL. The launcher passes a process-local argument instead of writing global preferences.
- The reload command uses Expo's accepted packager protocol and matching origin. An HTTP request to `/reload` is not sufficient.
- macOS-only prebuild adds irrelevant all-platform dependencies; the wrapper preserves the installed app manifest.
- Removed SDK packages must be excluded consistently from autolinking and codegen, and stale generated bindings must be removed.
- Release builds need explicit `ARCHS=arm64`; the destination alone does not prevent Intel compilation.
- A relative bundle entry avoids `/tmp` versus `/private/tmp` resolution failures in Xcode's bundling phase.

## Remaining scope

This is a local prototype, not the MVP or public beta. Runtime downloads/caching, public package releases, signing identities/notarization, update delivery, broader SDK APIs, and a real product-app migration remain the next milestones. Local ad-hoc signing is used for the test binaries.

The prototype supports static `app.json`, one JS application entry, and framework-owned module pruning. It conservatively retains third-party native packages. Dynamic app configuration, multiple window entrypoints, arbitrary runtime module lookup, and wider platform support are not claimed as implemented.

Native source availability and the absence of native build-command invocations were tested on a development machine. A genuinely toolchain-free machine remains part of the pre-MVP acquisition test. The debugger-opening action is implemented against the pinned Expo endpoint but was not included in the UI acceptance run.

Extracted menu/dialog source is currently an integration copy. `legend-apps` has not been migrated; the canonical ownership cutover is the next scoped integration task now that these packages are validated. Do not maintain divergent implementations indefinitely.
