# Known Windows issues

Updated 2026-09-14. Windows is an integrated target of the shared framework and Settings screen. Missing functionality is work to finish, not a reason to exclude the platform from shared application code.

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
| WIN-05 | Integrated Go/custom-build host has passed generation and bundle checks; Windows native acceptance is pending. | `bun run test:windows --project C:\dev\LegendWindowsVerification` passes compilation, Hermes startup, Fast Refresh, native dependency incompatibility detection, and custom-build switching. |
| WIN-06 | Broader desktop SDK parity is incomplete: broader dialogs/filesystem/settings, drag/drop, notifications/tray, processes/system, and external native integrations. | Port incrementally with an explicit per-feature acceptance record; split this inventory into individual issues as each area starts. Do not infer parity from the shared host. |
| WIN-07 | Standalone release/preview builds, signing/packaging and updates are not implemented. Portable SDK/client transfer exists; Windows clean-machine runtime startup is unverified. | Define the Windows distribution contract, implement it, and verify installation/launch/update on a clean machine. This remains outside the current development slice. |
| WIN-09 | Shared-host secondary React windows, title/show/hide/minimize/maximize, close/quit guards, focused shortcuts, basic menus, main-frame restoration, and single-instance file/URL forwarding now have native host source. AsyncStorage receives an unpackaged project-specific database path. | Compile on Windows; create/edit/close a secondary Notes window, verify failed saves cancel close, trigger Ctrl+N/S/O and menu actions, reopen into the same data/frame, and forward a file to the existing process. Advanced window styles, owned/modal windows, menu placement/targeting and OS association registration remain outside this implementation. |
| WIN-10 | Music Lite has a native MediaPlayer implementation and system transport controls. | Compile and play/pause/seek/end/error-check local audio; verify media controls, queue restoration, and disposal. |
| WIN-11 | Settings now bundles Uniwind's native runtime and shared responsive/theme classes. RNW 0.81.35 implements `Appearance.setColorScheme` as a no-op, so manual light/dark choices update app tokens but cannot be assumed to switch WinUI control chrome. | On Windows, verify resizing, system theme changes, manual light/dark/system selection, native control contrast, and unavailable-control frames; implement WinUI theme propagation for manual overrides. |
| WIN-08 | Secondary Hermes runtimes are not supported by the Windows integration. | Prove upstream/backend support and integrate worker lifecycle, compatibility, and native dependency selection into the existing framework. |

## Current acceptance commands

```sh
bun run test:windows:features --project C:\dev\LegendWindowsFeatures
bun run test:windows --project C:\dev\LegendWindowsVerification
```

The feature command generates a fresh universal app, compiles its native Windows client, then uses Windows UI Automation to invoke the WinUI Button, edit the TextBox, and select the ComboBox option. It checks their React callbacks plus clipboard round trips, credential write/read/delete, HTTPS-handler availability, text-file writing/reading, and conflicting saves. Run in an interactive Windows desktop session. It temporarily replaces clipboard text and restores that text afterward; use a disposable test session if the clipboard contains rich data.

On macOS, `bun run test:windows:features --prepare-only` performs generation and bundling only. It is not native acceptance. The new Windows C++ source has not yet been compiled or run on this development machine. WIN-01 through WIN-05 stay open until those checks pass.

The [document editor](document-editor.md) uses the native Windows file dialogs and text I/O. It now uses the shared window/close/menu/shortcut integration. Those new host paths need Windows acceptance before relying on them for unsaved work. OS association registration, advanced menu/window parity, and broader filesystem operations remain open. Notes Lite adds autosave and snapshot recovery at the application layer. Unsupported secondary-window style options and menu targeting, placement, payloads, and menu accelerators report an error; focused keyboard shortcuts are registered separately. Launch forwarding discovers an already initialized main window; simultaneous first launches still need an atomic single-instance guard.

The Settings screen now mounts the shared screen using real Windows backend bindings. If the UI module is absent or XAML initialization fails, controls display labeled, noninteractive placeholders; invalid Select options still fail contract validation. RNW 0.81.35's pinned Windows App SDK 1.8 includes XamlIsland; the backend connects it through RNW's ContentIslandComponentView. No dependency upgrade or upstream source patch was made.

Use the [Windows development guide](windows-slice.md) for machine setup. Record native build/runtime failures here with reproductions and acceptance checks. See [SDK distribution](sdk-distribution.md) for transferring an entire prebuilt Windows client once it has been built on Windows.
