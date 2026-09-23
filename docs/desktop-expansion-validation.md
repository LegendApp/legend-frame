# Desktop expansion validation — 2026-09-11

Scope: stages 1–4 of the desktop API plan, macOS 14+ / arm64. Validation ran
on this Apple Silicon Mac using Xcode 26.6.0, Bun 1.3.14, React Native macOS
and the pinned Expo Desktop beta. Source is in `spark`; builds ran
from `/tmp/spark-sdk-validation` because Bun stalls in the Documents checkout.
No packages or binaries were published.

## Automated evidence

| Check | Result |
| --- | --- |
| TypeScript | Pass: `bun run typecheck` |
| Unit/config/codegen suites | Pass: 109 tests, 418 assertions across 12 files |
| Go expansion | Pass: 9 cases covering window configuration/styles/constraints, child/modal close guards, process I/O/streaming/timeouts/cancellation, shortcut registration/conflicts/cleanup, system snapshot/sleep assertions, SQLite persistence/rollback, mounted WebView JS round-trip |
| Custom expansion | Pass: 11 cases — the Go cases plus a test-only driver for mounted drag hit testing/drop event delivery and native confirmation sheet completion |
| Full native regression | Pass: Go project A/B/A isolation, real reduced binary selection, 24 custom API cases, real Save acceptance, accepted quit |
| Native pruning | Pass: unused SDK modules plus WebView/SQLite excluded from runtime metadata and executable classes; Sparkle framework absent; retained APIs execute |
| Saved Go artifact | Pass: copied to `artifacts/runtimes/SparkRunner.app`, `codesign --verify --deep --strict` succeeds, registered with the local SDK |
| Standalone Release | Pass: starts without Metro, Sparkle initializes idempotently, automatic checks stay disabled, menu-bar-only window remains hidden; stale update config removal passes |

The full regression used `SPARK_TEST_UI_DRIVER=external`; computer use clicked
the real Save button because this Mac's XCTest service could not connect. All
other assertions ran automatically. The Release and full regression runs precede
the final modal-close and drag-targeting fixes; the focused expansion suite was
rerun against those fixes.

The drag fixture calls AppKit's destination protocol on real mounted Fabric
views and observes the emitted JavaScript events. It also checks both AppKit and
React Native nested hit-test routes. It does not substitute for a real drag-out
into Finder. The message fixture presses the actual NSAlert button in-process
and checks the returned button index and checkbox value. Neither fixture ships
in Go or ordinary apps.

## Interactive coverage and acceptance limits

The kitchen sink rendered, the overlay title-bar toggle worked, and a modal
window opened. Manual inspection found a modal close bug, fixed by explicitly
ending its parent sheet; automated guarded-close and subsequent-sheet checks
cover the fix. The drag-source review found Fabric's nested hit-test overload
bypassed the original override; that route now owns the source gesture.

The Mac locked during the final interaction pass. Cross-app drag/drop and actual
global shortcut key delivery remain to be exercised on an unlocked desktop.
Login startup registration/OS approval, physical sleep/wake/lock transitions,
and Dock-menu selection also remain OS-level acceptance checks. They are not
claimed as verified by the API tests. Rich clipboard HTML/RTF/PNG/file round-trips
passed in the native suite, which restores the original pasteboard representations.

## Reproduction

```sh
bun install
bun run typecheck
bun test tests
bun run test:expansion /tmp/SparkSDKKitchenSink
bun run test:native /tmp/SparkSDKKitchenSink
bun run test:updates /tmp/SparkUpdateReleaseProbe

bun run kitchen-sink /tmp/MyDesktopKitchenSink
cd /tmp/MyDesktopKitchenSink
bun dev
```

The native suite normally uses the XCTest UI driver. Set
`SPARK_TEST_UI_DRIVER=external` only when another UI driver or a person will
accept its Save panel. A native toolchain is required for these development and
Release validation builds. The already-built Go runtime does not require Xcode
for consumers to start a compatible JavaScript app.

Local logs and JSON reports are preserved under
`docs/evidence/expansion-2026-09-11/` (ignored by Git). Local SDK archives are in
`artifacts/packages/`; the refreshed Go app is in `artifacts/runtimes/SparkRunner.app`.
The full suite and release logs record exactly which binaries and phases ran.

## Kitchen sink event feedback — 2026-09-14

The example displays callback events in their own sections, retains six recent entries per section, and also forwards them to its shared event log. Native macOS checks verified window open/close events, the focused Command+Shift+K shortcut, streamed stdout/stderr and exit status, WebView messages, and the visible button-remount count. Global shortcut registration/removal also passed, but global delivery was not confirmed with synthetic key input. Notification responses, update delivery, incoming OS links/files, cross-app drag/drop, and tray/Dock selection delivery still need their environment-specific acceptance checks.

A separate native crash was observed during global-shortcut testing with keyboard focus inside the embedded WebView: after clicking the shortcut registration button, sending Command+Shift+F12 terminated Go with an `NSInvalidArgumentException`. The stack passes through `WKWebView`, `RCTViewKeyboardEvent keyEventFromEvent:reactTag:`, and `RCTComponentEvent initWithName:viewTag:body:` (attempt to insert a nil object). This was observed with React Native macOS 0.81.7 and react-native-webview 16.0.0; the precise cause and fix remain unverified. The JavaScript event panels cannot catch this native exception.

The focused-WebView keyboard crash recorded above was reproduced and fixed on
2026-09-18. See the [native regression evidence](macos-readiness-2026-09-18.md#webview-keyboard-follow-up).
