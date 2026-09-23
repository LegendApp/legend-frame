# Prototype status

The local Apple Silicon prototype is implemented and its Go → custom development build → reduced standalone app flow was validated on 2026-09-10.

## Margelo Runtimes prototype — 2026-09-12

A small macOS compatibility patch enables background Hermes execution with
`@react-native-runtimes/core`. Six native checks passed in both Debug and standalone
Release, including CPU responsiveness, native filesystem access and runtime recreation.
This is an optional custom-build prototype; Go and the default SDK are unchanged.
See [Runtimes prototype and upstream patch](runtimes-prototype.md).

## Desktop API stages 1–4 — 2026-09-11

Framework-owned `desktop.config.json`, window styles/child sheets, global
shortcuts, drag/drop, processes/helpers, rich dialogs/clipboard, system integration,
WebView and SQLite are implemented. The kitchen sink covers these APIs. See the
[API guide](desktop-api-expansion.md) and [current validation](desktop-expansion-validation.md).

The earlier pending custom Save/quit acceptance below is now passed: the real
Save button was exercised through computer use and the full native suite completed.
The current scope remains macOS 14+ / Apple Silicon.

## Notifications, tray and updates — 2026-09-11

The three integrations are implemented. The suite now has 89 passing tests; Go,
custom native APIs, signed-feed tooling, and standalone Release updater startup
passed. GUI and production install/relaunch acceptance remain outstanding.
See [integration validation](integrations-validation.md).

## Initial SDK expansion — 2026-09-11

The five SDK groups and kitchen sink are implemented. Typecheck, 73 Bun tests,
three Go isolation runs, and actual reduced-binary checks passed. Final custom
Save/quit UI acceptance is pending: XCTest cannot connect to its service and the
Mac is locked. See [SDK validation](sdk-validation.md) and [SDK usage](sdk.md).

## Original prototype verification — 2026-09-10

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
| Focused tests / TypeScript | 24 tests passed; typecheck passed |

Local validation reports, production selection, clean generation hashes, and native build logs are saved in `docs/evidence/`. These generated diagnostics are not committed.

## Local artifacts

- Go runtime: `artifacts/runtimes/SparkRunner.app`
- Standalone demonstration: `artifacts/demo/SparkHello.app`
- Framework package archives and manifest: `artifacts/packages/`
- External integration projects: `/tmp/SparkFrameworkGoProbe`, `/tmp/SparkFrameworkHello`, `/tmp/SparkFrameworkFreshSmoke`

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

This is a local prototype, not the MVP or public beta. Runtime downloads/caching, public package releases, real Developer ID/notarization acceptance, production update-install acceptance and a real product-app migration remain the next milestones. Local ad-hoc signing is used for the test binaries.

The `spark package` command now implements credential setup, signing, resumable notarization, stapling, and ZIP validation. Simulated end-to-end tests and real ad-hoc signature verification pass; no real Developer ID identity or notarization submission has been used. See [packaging validation limits](packaging.md#validation-status).

The prototype supports static `desktop.config.json` (with legacy `app.json` fallback), one JS application entry, and framework-owned module pruning. It also prunes the explicitly supported WebView and SQLite packages; other third-party native packages are retained conservatively. Dynamic app configuration, disconnected JS entrypoints, arbitrary runtime module lookup, and wider platform support are not claimed as implemented. Secondary windows now mount separate React roots from the same application entry.

Native source availability and the absence of native build-command invocations were tested on a development machine. The user subsequently confirmed the transferred Go test kit worked on another Mac. The expanded SDK still needs that same external retest. The debugger-opening action is implemented against the pinned Expo endpoint but was not included in the UI acceptance run.

Extracted menu/dialog source is currently an integration copy. `legend-apps` has not been migrated; the canonical ownership cutover is the next scoped integration task now that these packages are validated. Do not maintain divergent implementations indefinitely.

## Integrated background runtimes

Margelo Runtimes is integrated using direct `@react-native-runtimes/core` imports, with automatic host/Metro setup and production module pruning. See [runtimes.md](runtimes.md) for the pinned patches and verification commands.
