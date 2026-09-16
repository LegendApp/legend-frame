# Expo Desktop integration

Legend delegates project creation and native generation to the tested Expo Desktop beta. The pinned CLI is `expo-desktop@1.0.0-beta.6`; desktop native generation uses `expo-desktop-template-bare-minimum@54.81.1-beta.6`. Config plugins are pinned to `expo-desktop-config-plugins@1.2.0-beta.1`. Expo 54 / React Native 0.81 remain unchanged.

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
| Native SDK module selection, compatibility checks, runtime registration, prebuilt switching | Legend |
| Desktop build/launch orchestration | Legend pending upstream binary/session and build-only contracts (see below) |

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

**Desktop run/launch.** Beta.6 adds `run macos --binary` and a WIP `run windows`. This is the right upstream direction, but the macOS binary path still ensures a native project and resolves Xcode metadata before launching. A JavaScript-only binary probe enters prebuild and fails on a missing Windows-config assertion. With existing Xcode metadata it reaches launch, but starts Metro despite `--no-bundler`. The launcher uses `open` without our app arguments, connection settings, or an owned app process. There is also no macOS build-only switch to let Legend finalize/register the artifact before launching it.

Legend therefore retains desktop compilation and process ownership, module selection, build records, and prebuilt compatibility checks. App scripts continue to use Legend's development command, which delegates the terminal and Metro to Expo. Changing them directly to `expo-desktop run macos` would bypass this integration. Mobile/web already delegate to Expo's supported commands. See the [beta.6 handoff](expo-desktop-beta6-handoff.md) for reproductions and the proposed delegation boundary.

## Expo development terminal patch

`legend dev` launches the app's installed `expo start` under Node, inheriting stdin/stdout/stderr. Its Bun supervisor retains desktop runtime discovery, compatibility enforcement, native builds and owned app processes. It has no keyboard interface. Desktop actions and results travel over a private JSON IPC channel; no HTTP command endpoint is exposed.

Legend consumes its own `--project`, `--platform`, `--prebuilt-binary`, and `--no-open` options and forwards the remaining arguments to Expo. Expo retains `--go`/`--dev-client`, networking, cache clearing, validation, and port selection. Its readiness message supplies the actual port and bundle options.

The shared development config advertises all declared platforms and omits native build overlays. Expo Desktop supplies multi-platform Metro defaults; the desktop runtime gate is selected per request and does not block mobile/web. `desktop.config.json` remains separate. Native builds keep target-specific config and state.

`src/expo-dev-patch.cjs` pins `@expo/cli@54.0.27` and verifies SHA-256 hashes for three upstream modules before loading replacements in memory:

- `commandsTable.js`: place desktop runtime switching after Expo's runtime switch, and desktop opening/building after its platform launch actions, in both compact and expanded help.
- `startInterface.js`: dispatch `d`, `g`, and `b` through the desktop extension; log action failures without ending the session. Existing keys remain Expo's.
- `startAsync.js`: notify the supervisor of the actual native server port and bundle options after startup, including noninteractive sessions.

`expo-dev-preload.cjs` changes module loading only inside this Expo process and restores the loader after the three modules load. Installed files are never rewritten. Forked Metro workers inherit Node's preload arguments but skip the extension. Templates pin the CLI version; an unexpected version or modified source produces an explicit startup error rather than silently losing desktop controls. Projects declaring no desktop platforms and direct `expo start` do not load the patch. Selecting `dev --platform ios`, Android, or web in a desktop-capable project keeps the patch and host desktop keys.

On upgrade, review upstream changes, update the three source hashes and insertion points, and run `bun test tests/expo-dev.test.ts` plus a real packed-consumer session. Verify opening/switching, build failures, reload/debugger, Fast Refresh, compatibility invalidation, restart and Ctrl+C. Windows native actions additionally need a Windows host.

Noninteractive sessions still start Expo and can auto-open a compatible runtime, but they do not accept keyboard commands over a pipe. Automation should use explicit build commands and restart the session; `scripts/test-windows.ts` follows that path.

## Work to pair on with Jamie

- Accept npm 12's record-shaped metadata for local template paths.
- Honor dependency-preservation options during prebuild, including template-only additions, so Legend can remove manifest restoration and delegate installation more fully.
- Replace the temporary Expo CLI patch with supported desktop development-session actions and lifecycle hooks. Expo CLI owns the terminal; Expo Desktop could register desktop targets and Legend could provide the prebuilt launcher.
- Finish the existing `run macos --binary` contract: skip native generation/Xcode resolution, honor external Metro ownership, and support launch arguments/environment and process lifecycle. Add a macOS build-only mode so Legend can finalize and register artifacts before opening them.
- Verify a prebuilt launch from a JavaScript-only directory without Xcode, CocoaPods, codegen, or implicit prebuild. Exercise reload, Fast Refresh, custom-build switching, and two apps sharing a runtime at different ports.

Legend should retain runtime selection and compatibility policy while handing standard operations to upstream as those contracts become available. No upstream changes are required for the template creation path implemented here.

## Verification

`bun run test:templates` packs the SDK, creates macOS and Windows consumers through `legend create`, and creates a universal consumer directly through Expo Desktop. It checks identity, ignore-file extraction, configuration preservation, absence of native generation during creation, and consumer TypeScript. The consumers use a parent directory containing spaces.

`bun run test:universal` checks real mobile/Windows generation, all five shared-screen bundles, and preservation across target switching. `bun run test:windows:prepare` checks the Windows starter, native fixture addition, and runtime compatibility metadata without claiming Windows native execution.

Validated on macOS on 2026-09-13: 131 unit tests (564 assertions), workspace TypeScript, all three template consumers including direct upstream creation, iOS/Android/Windows native generation, and all five universal Settings bundles. The Windows preparation check also passed for both the starter and the added native-greeting module, including prebuilt incompatibility detection. Windows native compilation and execution still require a Windows machine.

Validated the Expo terminal patch on macOS on 2026-09-14: workspace TypeScript and 163 unit tests passed. A packed kitchen-sink consumer started the real Expo terminal, opened prebuilt runtime, switched to the missing-development-build state and back without compiling, reloaded through Expo, and launched DevTools. Native configuration invalidation blocked bundles with HTTP 409 and disconnected the owned Hermes runtime; restoring configuration restarted Expo. Fast Refresh delivered source edits, with zero idle updates over 12 seconds. Ctrl+C closed the session. Tests cover simulated Windows key selection, IPC dispatch, build-error recovery, version/source mismatch rejection, and worker preload isolation; native Windows launch and an actual build through the new key remain unverified.


Validated shared development sessions on macOS on 2026-09-14: TypeScript and 168 unit tests (750 assertions) passed. `test:universal:dev` served all five Settings graphs from one Expo process, preserved the platform UI/Uniwind backends, blocked only the incompatible host desktop's bundle, delivered one source edit to iOS and web HMR clients, restarted with desktop still incompatible, and removed the session/server on shutdown. Expo `--clear`, `--offline`, `--go`, and `-p` were exercised. `test:add-desktop` also passed; an additional live shared session preserved the adopted app's original entry, custom Metro resolver, plugin output, and all-platform manifest. These checks do not claim native app execution.

Configuration bridge code participates in Legend's conservative native signatures. Rebuild/re-register prebuilt against the repacked SDK when updating existing consumers to this change; the compatibility gate will reject an older host signature.

Validated beta.6 on macOS on 2026-09-16: workspace TypeScript, 226 unit tests (1,017 assertions), and Kitchen Sink native generation/build passed. All four desktop-foundation native probes passed (recursive watching, overlay focus, panel transparency/level, and custom drag negotiation). The upstream binary orchestration probe reproduced the blockers documented above; OS launch was intercepted, so it does not establish upstream native launch correctness. Windows native acceptance remains pending.
