# Legend Framework

Legend Framework is an experimental framework for building native desktop applications with React Native and Expo Desktop. It combines desktop APIs with an Expo-style development workflow: start in a supplied **Legend Go** runtime, switch to a custom development build when you need additional native code, and build a standalone application containing the native modules it needs.

Application JavaScript runs in **Hermes**. Node and Bun are development tools; neither is embedded as the application's JavaScript runtime. The UI uses React Native's native renderer.

**Current scope:** macOS 14+ on Apple Silicon. The packages, CLI, and native runtime are prototypes. A [transferable SDK with optional prebuilt Go clients](docs/sdk-distribution.md) works outside the checkout; public npm packages and hosted Go releases are not available. Windows x64 Go and custom development builds are integrated, with native verification still pending; see the [Windows development guide](docs/windows-slice.md). Mobile/web development delegates to Expo. Intel macOS, Linux, and Mac App Store distribution are not supported by this framework's current workflow.

## Start here

- **Build an app:** follow the [quick start](#quick-start) and [development guide](docs/development.md).
- **Add desktop to an existing Expo app:** use [the integration guide](docs/add-desktop.md) to preserve its entry point and mobile/web setup.
- **Test Windows development:** use the [integrated Windows workflow](docs/windows-slice.md) and `bun run test:windows`.
- **Use desktop APIs:** see the [SDK guide](docs/sdk.md) and [expanded API reference](docs/desktop-api-expansion.md).
- **Understand or change the framework:** read [ARCHITECTURE.md](ARCHITECTURE.md), including its source map and implementation invariants.
- **Work on Expo Desktop integration:** start with the [integration handoff](docs/expo-desktop-integration.md).
- **Check what has actually been tested:** see [validation and limitations](#validation-and-limitations). Implementation and recorded acceptance are different things.

## The development model

| Target | Native contents | JavaScript | When to use it |
| --- | --- | --- | --- |
| Legend Go | The supported SDK and its required native dependencies | Served by Metro | Start developing without compiling a native app |
| Custom development build | The SDK plus the app's additional native dependencies and configuration | Served by Metro | Add a native library or an app-specific native capability |
| Standalone application | The production-selected native module set | Embedded in the application | Run without Metro; prepare a distribution build |

The CLI checks the project's native requirements against the selected runtime. Ordinary JavaScript edits use Fast Refresh. Installing JavaScript-only packages does not itself require native compilation. A changed native dependency, incompatible SDK, or app-specific native configuration can require another binary.

The development terminal explains incompatibilities and offers a build/switch action. It does not silently compile on every file change. Switching binaries or restarting Metro can reset application state.

## Quick start

The steps below are for macOS; use the [Windows guide](docs/windows-slice.md) for its native prerequisites and development-only workflow.

This is a **local SDK workflow**. Run the following from a clone of this repository, not from a newly created consumer app.

### 1. Prepare the SDK

You need Bun 1.3.14 or newer and Node compatible with the pinned Expo/React Native toolchain. Building native binaries also requires an Apple Silicon Mac, full Xcode with first-launch setup completed, and CocoaPods. The SDK pack step uses Git, tar, and patch, and fetches pinned upstream Runtimes source on its first run.

```sh
bun install
bun run typecheck
bun test tests
bun run legend sdk pack
bun run legend sdk build-go
```

Use Node 24.19.0 (`nvm install && nvm use` in this checkout). Older Node 24 releases can fail on Expo Desktop beta's CommonJS imports; see [native prerequisites](docs/development.md#native-prerequisites).

`pack` creates SDK package archives and Expo Desktop-compatible application templates, then registers their manifest. `build-go` creates or refreshes the SDK's managed build project, compiles the generic native runtime, and registers it for app development.

If you already have a compatible runtime, register it instead of building it:

```sh
bun run legend sdk register /absolute/path/to/LegendGo.app
```

Registration records the path; keep the binary at that location. A compatible prebuilt Go runtime can be launched without invoking Xcode, CocoaPods, or codegen. Native build tools are needed when creating or rebuilding a binary.

### 2. Create and run an app

After preparing the SDK, run from the framework checkout:

```sh
bun run legend create /tmp/MyLegendApp
cd /tmp/MyLegendApp
bun run macos
```

`bun run macos`, `bun start`, and `bun dev` all run the same managed development session. The CLI discovers the registered runtime and chooses an available Metro port. The terminal provides actions to open, reload, debug, change runtime, build when required, and quit.

Edit `App.tsx` to change the application. In the development terminal, `s` changes runtime target, `b` builds when a custom binary is required, and `q` closes the session's processes. See the [development guide](docs/development.md) for flags, logs, debugger behavior, and adding native dependencies.

### 3. Build a standalone app

From the generated application:

```sh
bun run build
```

This produces a local ad-hoc-signed `.app` with embedded JavaScript and prints its path. It runs without the development server. To reopen the last standalone build:

```sh
bunx --no-install legend open
```

To prepare a Developer ID-signed, notarized distribution ZIP:

```sh
bun run package
```

Packaging requires signing credentials and a notarization profile. It signs a staging copy, supports resuming a pending submission, and validates the final archive. It does not publish the app. Read the [packaging guide](docs/packaging.md), especially its validation status, before relying on this as a production release pipeline.

## Windows development

Windows uses the same CLI, starter, Go registry, native compatibility checks, and managed Metro session. The current Windows starter includes the native host; the desktop SDK feature set is being ported separately. There is no separate source kit to install.

On Windows 11 x64, install the prerequisites in the [Windows guide](docs/windows-slice.md), including Visual Studio 2026 / MSVC v145 for the pinned RNW 0.81.35 template. Then run from the framework checkout:

```powershell
bun install
bun run legend sdk pack --platform windows
bun run legend sdk build-go --platform windows
bun run legend create C:\dev\MyLegendApp --platform windows
cd C:\dev\MyLegendApp
bun run windows
```

Creation defaults to Windows on a Windows machine. `bun run windows`, `bun dev`, and `bun start` enter the normal `legend dev` session. Additional Windows native dependencies use the normal custom-build path: the session detects incompatible Go code and offers `b`, or you can run `bunx --no-install legend build --dev` explicitly. Runtime registration distinguishes Windows/x64 from macOS/arm64.

For the automated Go → Fast Refresh → added native module → custom-build check, run from the framework checkout with a fresh destination:

```powershell
bun run test:windows --project C:\dev\LegendWindowsVerification
```

The verifier uses the real CLI and existing native-greeting fixture, and saves `.legend/windows-verification.json` plus `.legend/logs`. On macOS, `bun run test:windows:prepare --project /tmp/LegendWindowsCheck` checks generation and both development bundles without executing a native binary.

**Native Windows verification is still pending.** Local generation/bundle checks do not prove compilation, autolinking, Hermes startup, or Fast Refresh on Windows. Windows production builds, preview builds, signing/MSIX, clean-machine runtime distribution, the full desktop SDK, and secondary JavaScript runtimes are outside this development slice. See the [Windows guide](docs/windows-slice.md) for the full setup, test, and diagnostic workflow.

## What the SDK provides

The feature set below describes the macOS SDK; it is not a Windows API support matrix.

Framework-owned capabilities are imported from `@legend-apps/desktop/<feature>`. Use individual entry points so production analysis can associate JavaScript imports with native modules.

| Area | Entry points and capabilities |
| --- | --- |
| Application and windows | `app`, `windows`: identity, lifecycle, single-instance forwarding, secondary React roots, window styles, frame restoration, close/quit guards |
| Files and persistence | `files`, `settings`, `secure-storage`: filesystem operations and watches, JSON settings, project-scoped Keychain values |
| Desktop commands | `menus`, `context-menu`, `shortcuts`, `global-shortcuts`: menus, command handling, focused and system-wide shortcuts |
| User interaction | `dialogs`, `message-dialog`, `clipboard`, `drag-drop`: file panels, alerts, clipboard formats, drag sources and drop targets |
| OS integration | `links`, `notifications`, `tray`, `system`: URLs/documents, local notifications, menu-bar items, Dock/startup/power integration |
| Processes and distribution | `processes`, `updates`: child process IO and bundled helpers, signed whole-app update integration |
| External libraries | React Native WebView, OP-SQLite, and Margelo Runtimes; see [integrated external libraries](docs/external-libraries.md) |

For example, application code can use project-scoped storage without a Node filesystem API:

```ts
import { getDirectory, writeText } from '@legend-apps/desktop/files';
import { settings } from '@legend-apps/desktop/settings';

const dataDirectory = await getDirectory('data');
await writeText(`${dataDirectory}/draft.txt`, 'Hello from Legend');
await settings.set('theme', 'dark');
```

The SDK guide documents error behavior, disposal, event delivery, and platform-specific coordinate systems. Project-scoped storage separates app identities; it is not an OS security sandbox.

For external libraries, prefer their upstream imports and documentation. Legend supplies integration, native setup, tested pins, and supported production pruning. For example, background work uses `@react-native-runtimes/core` directly. It runs in independent Hermes heaps inside the application process and ends when the app quits. Read the [Runtimes guide](docs/runtimes.md) for serialization, cleanup, native-module restrictions, and production reachability.

## One app for mobile, web, and desktop

`bun run settings /tmp/MySettings` packs the shared Settings template and creates it through Expo Desktop beta. It uses the existing capability adapters, ordinary React Native layout, and native `Button`, `TextInput`, and `Select` controls from `@legend-apps/ui`. Mobile controls use the pinned Expo UI backend; desktop and web select their own implementations.

Run `bun run web`, `bun run ios`, `bun run android`, or `bun run macos` inside the generated app. Native targets first need their development build. Windows uses WinUI controls with visible, noninteractive fallbacks if native initialization fails; native Windows acceptance is still pending. Track remaining work in [known Windows issues](docs/windows-issues.md). See [the shared Settings guide](docs/universal-settings.md) for build commands, platform status, and verification.

A universal project declares all targets together. Switching with `--platform` preserves its shared configuration/source and the other generated native projects. Router integration and declarative windows remain deferred.

## Application configuration

New starters use static `desktop.config.json`. For single-target desktop starters, the CLI validates it and generates the `app.json` consumed by Expo Desktop. Universal starters use a managed dynamic `app.config.js` and target-specific overrides instead. Legacy projects containing only `app.json` remain supported. When desktop config is present, edit that source rather than the generated Expo file.

A typical generated configuration looks like this; retain the `projectId` assigned to your app:

```json
{
  "$schema": "./node_modules/@legend-apps/desktop-config/schema.json",
  "name": "MyLegendApp",
  "projectId": "f478dff4-f9a1-4ff2-8096-64df89e1c470",
  "version": "0.0.1",
  "window": { "width": 1000, "height": 700, "restoreFrame": true },
  "macos": { "bundleIdentifier": "com.example.mylegendapp" }
}
```

The stable project ID scopes storage and runtime identity across renames and builds. Window settings can be supplied to Go. Registering URL/document associations, configuring a menu-bar-only app or update feed, and embedding helper executables require a custom binary. The CLI also checks additional config plugins and native settings.

See [desktop configuration](docs/desktop-api-expansion.md#configuration) for fields and [architecture](ARCHITECTURE.md#configuration-and-identity) for ownership rules. Dynamic application config and unrelated JavaScript entry bundles are outside the current supported model.

## Explore the kitchen sink

From the framework checkout:

```sh
bun run kitchen-sink
bun run legend sdk build-go
cd .legend/examples/KitchenSink
bun dev
```

The preparation command packs the SDK and creates or refreshes the managed example. Its source lives in [examples/kitchen-sink](examples/kitchen-sink). It exercises desktop APIs with windows, an editor, menus, persistence, and an event log. Building/registering Go is required before its first compatible runtime launch.

## Commands and tests

Run framework commands from this repository; run app commands from a generated application.

| Location | Command | Purpose |
| --- | --- | --- |
| Framework | `bun run legend sdk pack` | Pack and register local SDK archives |
| Framework | `bun run legend sdk build-go` | Build/register the generic runtime |
| Framework | `bun run legend create <directory>` | Create a consumer from the packaged starter |
| App | `bun run macos` / `bun run windows` / `bun dev` / `bun start` | Managed development session for the project target |
| App | `bunx --no-install legend build --dev` | Build an app-specific development runtime |
| Framework | `bun run test:windows` | Verify the integrated Windows native development path |
| Framework | `bun run test:windows:prepare` | Check Windows generation and development bundles without native execution |
| App | `bunx --no-install legend analyze` | Explain macOS production native module selection |
| App | `bun run build` | Build a standalone macOS Release app |
| App | `bun run package` | Prepare a signed, notarized macOS distribution archive |
| App | `bun run doctor` | Diagnose native build prerequisites |

For framework changes, begin with the checks relevant to the change:

```sh
bun run typecheck
bun test tests
```

Native integration checks are separate and require Xcode, CocoaPods, and an unlocked/logged-in macOS desktop where UI interaction is involved:

```sh
bun run test:native
bun run test:expansion
bun run test:runtimes:all
# Complete configured suite, including native builds:
bun run test:all
```

`test:all` is substantial: it includes packaging/update tests, desktop integration tests, native application builds, and the Runtimes matrix. See [SDK tests](docs/sdk.md#tests), [Runtimes tests](docs/runtimes.md), and the root [package.json](package.json) for the current commands and prerequisites. Use an external packed consumer to verify distribution behavior; workspace symlinks alone cannot prove the CLI archive is complete.

## Validation and limitations

The macOS Go → custom runtime → reduced standalone workflow has recorded native validation. Desktop API expansion and integrated background runtimes have their own dated reports. Test counts and feature coverage change; consult the specific report rather than treating an old count as the current suite size.

| Evidence | What it covers |
| --- | --- |
| [Prototype status](docs/prototype-status.md) | Original workflow, milestones, and remaining release gates |
| [SDK validation](docs/sdk-validation.md) | Initial desktop SDK and project isolation |
| [Desktop expansion validation](docs/desktop-expansion-validation.md) | Expanded APIs, native pruning, and interactive acceptance limits |
| [Integration validation](docs/integrations-validation.md) | Notifications, tray, updater startup and signing tooling |
| [Runtimes validation](docs/runtimes-validation.md) | Direct upstream imports, worker behavior, reload, and pruned Release builds |
| [Windows development](docs/windows-slice.md) | Integrated CLI, generation and bundle checks; native acceptance pending |
| [Packaging status](docs/packaging.md#validation-status) | Simulated notarization pipeline versus real distribution acceptance |

Public SDK/Go distribution, real Developer ID/notarization acceptance, production update installation/relaunch, and broader platform support remain separate release gates. Some OS interaction cases also remain outstanding in their feature reports. No current test result establishes full Windows support.

## Repository and documentation

The main boundaries are `packages/cli` for orchestration, `packages/config-plugin` for configuration/native generation, `packages/desktop-host` for application startup, and feature packages for desktop APIs. `packages/desktop` provides the public framework entry points. `scripts`, `fixtures`, and `examples` provide packaging and validation workflows.

[ARCHITECTURE.md](ARCHITECTURE.md) explains these boundaries, runtime compatibility, production pruning, generated artifacts, and where to change code. It also documents the integrated Windows adapter and the work remaining beyond the development slice. The [Expo Desktop handoff](docs/expo-desktop-integration.md) separates integration available today from the proposed upstream `--binary` launch contract.

The [Expo API adapters](docs/expo-api-adapters.md) document the current clipboard, secure-storage, and linking migration and its kitchen-sink checks. [Native UI](docs/ui.md) starts with an AppKit button and Expo UI mobile adapters. The [API ownership policy](docs/external-libraries.md#public-contracts-and-replaceable-implementations) describes stable framework contracts with replaceable native, Expo, or community implementations. Router integration and the broader UI catalog remain deferred.

The [universal API plan](docs/universal-api-plan.md) proposes one web/mobile/desktop codebase, Expo-aligned capability APIs, Expo UI adapters, and declarative window presentation through Expo Router. It is awaiting review and does not describe implemented functionality. The earlier [API structure review](docs/api-structure-review.md) retains the current SDK inventory.

Use the [implementation plan](docs/implementation-plan.md) for original decisions and milestones; newer feature guides and dated validation reports describe subsequent work. These documents describe an evolving source checkout, not a claim that every feature is published or production-qualified.

## Shared application and SDK transfer

`legend create MyEditor --example document-editor` creates a [shared document editor](docs/document-editor.md) using Expo adapters on mobile, browser file operations on web, and native desktop dialogs. The macOS example exercises windows, menus, shortcuts, file-open events, and unsaved-change guards. Windows includes native control/API/file-dialog implementations, with remaining native acceptance and lifecycle gaps listed in [known Windows issues](docs/windows-issues.md).

[SDK export/import](docs/sdk-distribution.md) packages the CLI, module archives, and optional prebuilt Go clients into a transferable directory. The recipient installs it without this checkout; Expo Desktop beta still owns creation and desktop generation, and Legend retains native compatibility checks.

## Small application examples

[Notes Lite, Music Lite, and Diff Lite](docs/example-apps.md) are standalone universal
CLI examples, created with `legend create MyApp --example notes-lite` (or
`music-lite` / `diff-lite`). They share application models and screens, with
platform files for native lifecycle, selected-file access, and playback. Source
ships with the CLI and depends only on public package imports.

The examples use upstream AsyncStorage with project-scoped keys and recoverable
snapshots. The unpackaged Windows host configures its supported database-path
override. The small [audio contract](docs/audio.md) delegates to Expo Audio on
mobile, AVPlayer on macOS, MediaPlayer on Windows, and HTML audio on web. Queue and
note models remain application-owned. The maintained Go profile now includes audio
and AsyncStorage; existing clients require a rebuild for those native additions.

Windows host source also supplies window roots sharing the host's React runtime,
close/quit guards, focused shortcuts, basic menus, frame restoration, and launch
forwarding. Native compilation and acceptance remain tracked in
[known Windows issues](docs/windows-issues.md); generated bundles do not prove them.
See [extension development](docs/extensions.md) for adding a native library or
replacing a backend while preserving a framework contract.
