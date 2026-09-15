# Known Windows issues

Updated 2026-09-15. Windows is an integrated target of the shared framework and Settings screen. Missing functionality is work to finish, not a reason to exclude the platform from shared application code.

## Handling incomplete implementations

- Fix the implementation when possible. Until a native UI backend exists, render a visible, noninteractive placeholder in its place. Preserve labels, layout, and test IDs without importing an unavailable native binding.
- Do not invoke callbacks or report successful operations from placeholders. Non-UI operations with missing backends continue to report `E_UNAVAILABLE`; availability checks reflect the installed backend.
- Do not broadly catch rendering errors to hide programming mistakes. For example, invalid Select options still fail contract validation.
- Keep each issue open until its acceptance checks pass on Windows. Generation, bundling, and mocked rendering are useful checks, but do not prove native execution.

## Open work

| ID | Issue and current behavior | Completion criteria |
| --- | --- | --- |
| WIN-01 | WinUI Button implementation added through RNW ContentIsland; native compilation and acceptance pending. Initialization failure renders a labeled placeholder. | Real native button; click and keyboard activation, disabled behavior, labels, and React callbacks work in the shared screen. |
| WIN-02 | WinUI TextBox implementation added, preserving the uncontrolled default-value contract; native acceptance pending. | Native editing, initial text, change callbacks, accessibility, and documented reset behavior work without losing focus unexpectedly. |
| WIN-03 | WinUI ComboBox implementation added with semantic value mapping and suppressed programmatic callbacks; native acceptance pending. | Native selection preserves semantic values across reordered options and delivers callbacks; keyboard and accessibility checks pass. |
| WIN-04 | Text/HTML clipboard, project-scoped Credential Manager storage, URI launching/querying, and initial command-line URL implemented. Recent documents and rich clipboard parity remain open. Queued/warm activation source is now supplied by the host, pending native acceptance. Credential values are limited to 2560 UTF-16 bytes. | Implement the agreed shared contracts and run their behavior checks on Windows, including failure cases and URL lifecycle where applicable. |
| WIN-05 | Integrated prebuilt/custom-build host has passed generation and bundle checks; Windows native acceptance is pending on x64 and ARM64. ARM64 detection, target selection, separate binaries, and runtime compatibility are implemented for Parallels. | `bun run test:windows --project C:\dev\LegendWindowsVerification` passes compilation, Hermes startup, Fast Refresh, native dependency incompatibility detection, and custom-build switching on both x64 and ARM64; Parallels requires the ARM64 compiler tools. |
| WIN-06 | Broader desktop SDK parity is incomplete: message dialogs/context menus, drag/drop, notifications/tray, processes/system, and external native integrations. | Port incrementally with an explicit per-feature acceptance record; split this inventory into individual issues as each area starts. Do not infer parity from the shared host. |
| WIN-07 | Standalone release/preview builds, signing/packaging and updates are not implemented. Portable SDK/client transfer exists; Windows clean-machine runtime startup is unverified. | Define the Windows distribution contract, implement it, and verify installation/launch/update on a clean machine. This remains outside the current development slice. |
| WIN-09 | Shared-host secondary React windows, title/show/hide/minimize/maximize, close/quit guards, focused shortcuts, basic menus, main-frame restoration, display enumeration, frame/center/fullscreen operations, basic sizing/presentation options, and single-instance file/URL forwarding now have native host source. A project-scoped named mutex covers simultaneous startup and abandoned-owner recovery; menus follow the focused React window. AsyncStorage receives an unpackaged project-specific database path. | Compile on Windows; create/edit/close a secondary Notes window, verify failed saves cancel close, trigger Ctrl+N/S/O and menu actions, reopen into the same data/frame, and forward a file to the existing process. Advanced window styles, owned/modal windows, menu placement/targeting and OS association registration remain outside this implementation. Verify concurrent launch forwarding, owner-termination recovery, display geometry/scales, constraints and fullscreen restoration. |
| WIN-10 | Music Lite has a native MediaPlayer implementation and system transport controls. | Compile and play/pause/seek/end/error-check local audio; verify media controls, queue restoration, and disposal. |
| WIN-11 | Settings now bundles Uniwind's native runtime and shared responsive/theme classes. The UI package now supplies an Appearance TurboModule overriding RNW 0.81.35's no-op setter. It propagates light/dark/system changes to existing and new WinUI control islands through native notifications, without remounting controls or adding framework-specific React props. Native acceptance is pending. | On Windows, verify resizing, system theme changes, manual light/dark/system selection, native control contrast, and unavailable-control frames; verify WinUI theme propagation, focus/text preservation, and system changes after resetting the override. This does not promise manual theme overrides for OS dialogs/title bars or every RNW PlatformColor resource. |
| WIN-08 | Secondary Hermes runtimes are not supported by the Windows integration. | Prove upstream/backend support and integrate worker lifecycle, compatibility, and native dependency selection into the existing framework. |

## Shared platform coverage

The [platform test system](platform-testing.md) separates actual execution from generation/bundling and keeps missing Windows implementations visible. `test:windows:features` now emits the common JSON report and reuses the clipboard/storage/link/file assertions with macOS. The generic `test:platform --platform windows` runs the universal test screen on the selected x64/ARM64 target. Neither runner's prepare-only results close native acceptance issues.

## Current acceptance commands

```sh
bun run test:windows:features --project C:\dev\LegendWindowsFeatures
bun run test:windows --project C:\dev\LegendWindowsVerification
```

The feature command generates a fresh universal app, compiles its native Windows client, then uses Windows UI Automation to invoke the WinUI Button, edit the TextBox, and select the ComboBox option. It checks their React callbacks plus clipboard round trips, credential write/read/delete, HTTPS-handler availability, text-file writing/reading, conflicting saves, display/window operations, and React Native Appearance overrides/events. It starts two clients simultaneously and checks that one survives and receives both launch URLs, then terminates that owner and verifies a new launch recovers. Run in an interactive Windows desktop session. It temporarily replaces clipboard text and restores that text afterward; use a disposable test session if the clipboard contains rich data.

On macOS, `bun run test:windows:features --prepare-only` performs generation and bundling only. It is not native acceptance. The new Windows C++ source has not yet been compiled or run on this development machine. WIN-01 through WIN-05 stay open until those checks pass.

The [document editor](document-editor.md) uses the native Windows file dialogs and text I/O. It now uses the shared window/close/menu/shortcut integration. Those new host paths need Windows acceptance before relying on them for unsaved work. OS association registration, advanced menu/window parity, and filesystem native acceptance remains open. Notes Lite adds autosave and snapshot recovery at the application layer. Unsupported secondary-window style options and menu targeting, placement, payloads, and menu accelerators report an error; focused keyboard shortcuts are registered separately. Launch forwarding acquires a named mutex before host construction. A concurrent process waits for the primary window, forwards its command line, and exits; a timeout reports failure instead of starting a second writer. The OS releases ownership after process termination. Native race/recovery acceptance remains pending.

The Settings screen now mounts the shared screen using real Windows backend bindings. If the UI module is absent or XAML initialization fails, controls display labeled, noninteractive placeholders; invalid Select options still fail contract validation. RNW 0.81.35's pinned Windows App SDK 1.8 includes XamlIsland; the backend connects it through RNW's ContentIslandComponentView. No dependency upgrade or upstream source patch was made.

Use the [Windows development guide](windows-slice.md) for machine setup. Record native build/runtime failures here with reproductions and acceptance checks. See [SDK distribution](sdk-distribution.md) for transferring an entire prebuilt Windows client once it has been built on Windows.


### Expo development options

The shared `legend dev` server accepts Expo start options and serves all declared platforms. The current Windows native host uses HTTP development bundles without minification; opening it with `--https`, `--no-dev`, or `--minify` reports the limitation. Implement those connection/bundle settings in the RNW host before claiming native support for them. Mobile/web can use these Expo options in the shared server.

Expo Desktop's RNX platform discovery can print missing `dotnet.exe`/`pwsh.exe` diagnostics when inspecting RNW on macOS. The shared server and Windows bundle generation continue; eliminating that unnecessary toolchain probe is an upstream integration follow-up.

## Foundation work — 2026-09-15

Implemented WIN-09/WIN-11 source changes remain pending Windows acceptance. The
Windows feature verifier generates and bundles successfully on macOS; TypeScript
and 173 unit tests pass. The verifier now
includes the window package explicitly in its consumer. The package-builder
Appearance override uses RNW's supported TurboModule replacement mechanism rather
than modifying installed RNW source. `RequestedTheme` is applied to individual
WinUI controls; native failure still reports through the existing placeholder path.
WinRT activation of host JSON arrays now occurs after COM initialization. Template
hook replacement happens before embedding host source, preventing an identical
API call inside the embedded code from being rewritten accidentally.

For manual acceptance, toggle Light → Dark → System in Settings with text entered
and the editor focused, open a new window under each theme, change the OS theme
while System is selected, and check control/flyout contrast and preserved edits.
Check high-contrast mode separately. Use mixed-DPI monitors for display scales,
centering and frame operations. Run the automated commands above in a fresh
project directory; their native checks have not been executed on this macOS host.

Remaining feature work includes app-owned recent documents/rich clipboard, owned
or modal windows and AppKit-specific presentation, broader menu features and OS
associations, and WIN-06's unported modules. Production packaging/updates and
secondary Hermes runtimes remain separate from this development foundation.

## Filesystem and settings parity — 2026-09-15

Windows now implements the complete existing filesystem surface: project-scoped
app directories, UTF-8/base64 reads and atomic writes, metadata, sorted listings,
directory creation, recursive removal/copy, moves, and nonrecursive watch
invalidation. Drive-qualified paths, UNC paths, and local file URLs are accepted;
relative paths and device namespaces are rejected. Watchers observe a file's
parent and are disposed on unsubscribe/runtime teardown. Filesystem errors retain
the shared `E_NOT_FOUND`, `E_PERMISSION`, `E_EXISTS`, `E_NOT_EMPTY`, and `E_IO` codes.
The existing settings implementation uses this backend without a new API.

`test:platform` now exercises the same filesystem/settings cases on macOS and
Windows. `test:windows:features` additionally checks that a saved setting survives
owner termination and relaunch. Native compilation/execution remains pending;
verify permissions, UNC shares, symlinks, cross-volume moves, and watch teardown
on Windows in addition to the automatic disposable-directory checks. Implemented
catalog entries remain `not-tested` until executed successfully.
