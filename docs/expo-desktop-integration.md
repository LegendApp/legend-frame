# Expo Desktop integration

Legend delegates project creation and native generation to the tested Expo Desktop beta. The pinned CLI is `expo-desktop@1.0.0-beta.5`; desktop native generation uses `expo-desktop-template-bare-minimum@54.81.1-beta.5`. Expo 54 / React Native 0.81 remain unchanged.

## Ownership

| Responsibility | Owner |
| --- | --- |
| Validate destination/name, extract starter, assign native IDs, install dependencies, initialize Git | Expo Desktop `create-app --template` |
| Starter files, scripts, dependency matrix, Settings screen | Legend's macOS/Windows/universal template packages |
| Initialize stable Legend identity and canonical config | One-time template postinstall, using upstream-assigned identity |
| Generate desktop native projects | Expo Desktop `prebuild --template` with Legend config plugins |
| Development terminal, Metro lifecycle, reload/debugger, mobile/web actions | Installed Expo CLI; process-local Legend desktop-key patch |
| Mobile prebuild/build/run and web development | Installed Expo CLI |
| Standard desktop Metro configuration | Expo Desktop Metro, extended for Legend sessions/runtimes |
| Native SDK module selection, compatibility checks, runtime registration, Go switching | Legend |
| Desktop build/launch orchestration | Legend while the pinned beta has no desktop `run` command |

The native bare-minimum template remains upstream-owned. Legend config plugins add the host and selected capabilities. The small `/ui` and capability adapters are independent of the creation mechanism.

Existing applications can use [`legend add desktop`](add-desktop.md) to compose desktop support into their Expo config and Metro setup. This path preserves the original entry point and mobile/web commands; it does not create an app from a Legend template.

## Templates

`packages/cli/templates/blank-typescript`, `windows`, and `universal` are complete application templates. `scripts/pack.ts` first packs SDK dependencies, then `scripts/pack-templates.ts` resolves the local archive paths into the template manifests and packs them. `artifacts/packages/templates.json` maps each variant to its archive.

`legend create` selects that archive and invokes the real Expo Desktop CLI. It does not copy the starter, rename files, replace platform source files, or maintain an extraction implementation. Upstream validates alphanumeric application directory names; parent paths may include spaces.

Each template has an initial `app.json` for upstream naming and native identifier generation, plus Legend configuration defaults. After installation, `init-template.cjs` adopts the assigned name, bundle identifiers, and Windows project GUID into Legend configuration. It then prepares the existing Expo configuration bridge. An existing Legend project ID makes initialization a no-op, preserving subsequent user edits. If installing with lifecycle scripts disabled or creating with `--no-install`, run the template's postinstall after installing dependencies.

The same tarball works with `expo-desktop create-app --template` without going through `legend create`. Local archives contain absolute SDK tarball references, so keep those archives available and repack on another machine. Publishing templates/packages is outside this change.

## Narrow beta compatibility handling

**npm 12 local template metadata.** In beta.5, `npmPackAsync` accepts an array, or a record keyed by the requested package spec. npm 12 returns a record keyed by the package's name when inspecting a local tarball, so lookup by absolute tarball path fails. The CLI includes npm `11.11.0` and puts its small launcher first on PATH only for the creator subprocess. Expo Desktop performs extraction normally and delegates installation to Bun. Global npm and upstream source remain unchanged.

For direct template creation, use npm 11 on PATH. The installed CLI's `src/npm-bin` directory supplies the same scoped compatibility launcher; `test:templates` exercises this path. Remove this adapter once the beta accepts npm 12 local-tarball metadata and the direct-creation checks pass.

**Prebuild dependency preservation.** The pinned beta accepts `skipDependencyUpdate`, but its dependency update implementation does not use it. Its bare-minimum template can add dependencies for other platforms even with `--no-install`. Legend therefore retains manifest restoration around native generation. On macOS it runs CocoaPods after restoring the intended graph and clearing stale generated bindings. Native generation/build commands against one checkout must remain sequential.

**Desktop run/launch.** The pinned CLI exposes `create-app` and `prebuild`; it does not expose `run macos --binary`. Legend retains direct desktop compilation and process ownership while preserving its module selection, build records, and Go compatibility checks. Mobile/web already delegate to Expo's supported commands.

## Expo development terminal patch

`legend dev` launches the app's installed `expo start` under Node, inheriting stdin/stdout/stderr. Its Bun supervisor retains desktop runtime discovery, compatibility enforcement, native builds and owned app processes. It has no keyboard interface. Desktop actions and results travel over a private JSON IPC channel; no HTTP command endpoint is exposed.

`src/expo-dev-patch.cjs` pins `@expo/cli@54.0.27` and verifies SHA-256 hashes for three upstream modules before loading replacements in memory:

- `commandsTable.js`: place desktop runtime switching after Expo's runtime switch, and desktop opening/building after its platform launch actions, in both compact and expanded help.
- `startInterface.js`: dispatch `d`, `g`, and `b` through the desktop extension; log action failures without ending the session. Existing keys remain Expo's.
- `startAsync.js`: notify the supervisor of the actual native server port after startup, including noninteractive sessions.

`expo-dev-preload.cjs` changes module loading only inside this Expo process and restores the loader after the three modules load. Installed files are never rewritten. Forked Metro workers inherit Node's preload arguments but skip the extension. Templates pin the CLI version; an unexpected version or modified source produces an explicit startup error rather than silently losing desktop controls. Mobile/web-only Legend commands and direct `expo start` do not load the patch.

On upgrade, review upstream changes, update the three source hashes and insertion points, and run `bun test tests/expo-dev.test.ts` plus a real packed-consumer session. Verify opening/switching, build failures, reload/debugger, Fast Refresh, compatibility invalidation, restart and Ctrl+C. Windows native actions additionally need a Windows host.

Noninteractive sessions still start Expo and can auto-open a compatible runtime, but they do not accept keyboard commands over a pipe. Automation should use explicit build commands and restart the session; `scripts/test-windows.ts` follows that path.

## Work to pair on with Jamie

- Accept npm 12's record-shaped metadata for local template paths.
- Honor dependency-preservation options during prebuild, including template-only additions, so Legend can remove manifest restoration and delegate installation more fully.
- Replace the temporary Expo CLI patch with supported desktop development-session actions and lifecycle hooks. Expo CLI owns the terminal; Expo Desktop could register desktop targets and Legend could provide the Go launcher.
- Define a generic prebuilt-binary launch contract, such as the proposed `expo-desktop run macos --binary <app>`, with explicit Metro ownership/port, launch arguments/environment, failure reporting, and process termination.
- Verify a Go launch from a JavaScript-only directory without Xcode, CocoaPods, codegen, or implicit prebuild. Exercise reload, Fast Refresh, custom-build switching, and two apps sharing a runtime at different ports.

Legend should retain runtime selection and compatibility policy while handing standard operations to upstream as those contracts become available. No upstream changes are required for the template creation path implemented here.

## Verification

`bun run test:templates` packs the SDK, creates macOS and Windows consumers through `legend create`, and creates a universal consumer directly through Expo Desktop. It checks identity, ignore-file extraction, configuration preservation, absence of native generation during creation, and consumer TypeScript. The consumers use a parent directory containing spaces.

`bun run test:universal` checks real mobile/Windows generation, all five shared-screen bundles, and preservation across target switching. `bun run test:windows:prepare` checks the Windows starter, native fixture addition, and runtime compatibility metadata without claiming Windows native execution.

Validated on macOS on 2026-09-13: 131 unit tests (564 assertions), workspace TypeScript, all three template consumers including direct upstream creation, iOS/Android/Windows native generation, and all five universal Settings bundles. The Windows preparation check also passed for both the starter and the added native-greeting module, including Go incompatibility detection. Windows native compilation and execution still require a Windows machine.

Validated the Expo terminal patch on macOS on 2026-09-14: workspace TypeScript and 163 unit tests passed. A packed kitchen-sink consumer started the real Expo terminal, opened Legend Go, switched to the missing-development-build state and back without compiling, reloaded through Expo, and launched DevTools. Native configuration invalidation blocked bundles with HTTP 409 and disconnected the owned Hermes runtime; restoring configuration restarted Expo. Fast Refresh delivered source edits, with zero idle updates over 12 seconds. Ctrl+C closed the session. Tests cover simulated Windows key selection, IPC dispatch, build-error recovery, version/source mismatch rejection, and worker preload isolation; native Windows launch and an actual build through the new key remain unverified.
