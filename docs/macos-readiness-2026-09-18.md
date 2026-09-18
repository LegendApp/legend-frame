# macOS readiness validation — 2026-09-18

## Decision

The current feature scope is sufficient for a scoped developer beta, but this
session does **not** establish launch readiness. The immediate secondary-window
closure crash found during this session is now fixed and passed repeated native
regression checks (see below). The unresolved interaction checks still remain.
Windows and standalone/distribution acceptance were outside this session.

## Environment and scope

Apple Silicon macOS, Node 24.19.0, Bun 1.3.14, Expo Desktop beta.6. The platform
runner created and compiled a fresh packed-SDK consumer. Focused probes rebuilt
the checked-in Kitchen Sink development runtime. Release-build work was happening
concurrently in the checkout; no claim is made about that work here.

The shared platform report is
`.legend/test-results/47b6dd3a-9a0c-4a59-889c-98a267dce255.json`.
It retains **27 passed, 3 failed, 1 not applicable, 16 not tested**, and an
interrupted execution status. It was stopped after notification permission failed
to present an actionable prompt in this remote session. Later focused rechecks
below supplement that report; they do not erase its original failures.

## Passed

- TypeScript and 243 unit tests.
- Fresh packed consumer creation, macOS JavaScript bundle, native Debug build,
  launch and native runtime identity.
- Clipboard text/rich data, secure storage lifecycle, URL resolution, settings,
  recent documents and native child-process operations.
- Native button, edited text input, and semantic select callbacks through actual
  UI interaction.
- SQLite parameters, binary data, rollback, close/reopen persistence and cleanup.
- Nitro native buffer and HybridObject identity/boxing checks.
- Independent Hermes runtimes: retained worker state, isolation, errors,
  enumeration, destruction and recreation.
- WebView HTML and URL loading, injected JavaScript, native messaging and unmount.
- Native message dialog default/cancel buttons and checkbox results; context menu
  selection and dismissal; modal window closure; native menu accelerators.
- Streaming binary round trip, positional changes, EOF, exclusive creation,
  truncation, early iteration exit, cancellation and handle closure.
- OS Trash, plus Finder **Put Back** and readback of the restored disposable file.
- Full filesystem lifecycle after correcting the Unicode assertions described
  below, including atomic-replacement watching and unsubscription.
- Native overlay nonactivation/focus preservation, transparency, borderless style
  and status level; recursive watching; custom drag data, hover and move-result
  callbacks. The native driver invokes drag callbacks; it is not an external
  cross-application OS drag acceptance test.
- Focused native close-guard veto, quit-guard veto and single-instance forwarding.

Focused reports:

- `.legend/file-stream-tests/report.json`
- `.legend/filesystem-recheck-2026-09-18.json`
- `.legend/desktop-foundation-tests/report.json`
- `.legend/lifecycle-recheck-2026-09-18.json`

## Native crash found and fixed

`bun scripts/test-sidecars.ts` aborted twice with the original source. Its helper
lifecycle test opens `sidecar-owner-probe` and immediately closes it. The crash
stack is:

```
SurfaceHandler::getMountingCoordinator()
-[RCTScheduler setupAnimationDriver:]
-[RCTSurfacePresenter setupAnimationDriverWithSurfaceHandler:]
-[RCTFabricSurface start]_block_invoke_2
```

The assertion is `link_.shadowTree must not be null`. This is consistent with
surface shutdown racing asynchronous Fabric startup. This was a window lifecycle
blocker, not evidence that the helper protocol itself was broken.

A diagnostic run inserted a one-second delay before that window close. All nine
helper checks then passed, including binary output beyond the capture limit,
Unicode I/O, exit status, descendant cleanup, readiness, concurrent requests,
crash/restart, deadlines, and cleanup of a live helper on normal app quit. The
diagnostic delay was removed. That run was diagnostic evidence only.

Local crash reports:

- `~/Library/Logs/DiagnosticReports/KitchenSink-2026-09-18-023242.ips`
- `~/Library/Logs/DiagnosticReports/KitchenSink-2026-09-18-023429.ips`

## Fix and regression evidence

The macOS config plugin now applies a version-checked compatibility fix to
`react-native-macos@0.81.7` during native generation. Surface startup holds the
lifecycle mutex through animation-driver setup. Generation tokens cancel queued
starts after stop and prevent stale detaches from affecting a later start.
Attachment tracking makes repeated stop/deallocation safe.

The sidecar regression now performs 50 immediate open/close cycles using the same
window ID, without a delay, and checks registry cleanup after every close. Two
consecutive rebuilt-native runs passed all nine helper checks: **100 immediate
open/close cycles**, helper survival, binary streaming, failure/deadline handling,
and cleanup on normal app quit. `.legend/sidecar-tests/report.json` now contains
an unmodified post-fix stress-run result. Streaming/Trash and the native overlay/drag callbacks also passed again. A separate
`bun scripts/test-fabric-reload.ts` probe passed three full React Native reloads
and another 40 immediate window-close cycles. TypeScript and all 247 unit tests
passed after the fix.

The packed desktop-config archive was checked against the source patch. Tests
cover pristine-source application, repeated application, changed-source rejection,
version gating and preservation of hardlinked package-cache files. Existing native
runtimes must be rebuilt; JavaScript reload cannot apply this fix. The config-plugin
source participates in the native runtime compatibility signature.

## Harness corrections

The platform runner needed the shared file-stream source copied into its consumer,
the public desktop package installed, and file/overlay result IDs allowed through
its report transport. These corrections were included before the fresh native run.

The filesystem test compared a precomposed `ü` with macOS's decomposed `u` plus
combining umlaut, both in directory listings and watch callbacks. Assertions now
compare NFC-normalized names/paths. A focused rerun passed the whole filesystem
lifecycle. No filesystem implementation change was necessary.

## Still unresolved or outside the run

- The September 14 [desktop expansion report](desktop-expansion-validation.md#kitchen-sink-event-feedback--2026-09-14) records a separate native keyboard-event crash with an embedded WebView focused (Command+Shift+F12). Its cause/fix remains unverified. This session tested WebView load and messaging, not that keyboard path; it must not be treated as resolved by the Fabric lifecycle fix.

- The global shortcut interaction timed out after synthetic input while trying to
  focus Finder. Registration is not proof of delivery; repeat with physical input.
- The tray menu action timed out because its status item was not exposed through
  the available remote accessibility view. Repeat menu selection on the machine.
- Notification permission/delivery was blocked by the remote session's lack of an
  actionable permission prompt. No delivery or notification-click claim is made.
- Dock actions, external OS drag/drop, appearance/focus transitions, denied-access
  file cases, reload cleanup, Fast Refresh state preservation, abrupt owner-death
  recovery, and extended-use/leak checks were not newly accepted here.
- Standalone apps, signing, installation, updates, Windows, mobile and web were not
  validated by this session.

Before launch, document one explicit supported-platform/capability baseline and
link its current evidence. Older prototype and integration reports remain dated
history, not proof that the current release passed every case. The README covers
the implemented features and local setup, but documentation completeness should
not be used to imply completion of these acceptance gaps.

## Local artifacts

The two fresh platform consumer directories occupy approximately 1.0 GiB and
4.6 GiB respectively:

- `.legend/platform-tests/Platformmacos1789723747074` (initial bundle failure)
- `.legend/platform-tests/Platformmacos1789723802516` (native acceptance consumer)

They are disposable test artifacts, retained for inspection; no cleanup was
performed. Focused copied application bundles were removed by their test runners.
