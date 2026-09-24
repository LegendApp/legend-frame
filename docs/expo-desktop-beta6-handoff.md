# Expo Desktop beta.6 delegation handoff

spark now pins `expo-desktop@1.0.0-beta.6`, `expo-desktop-config-plugins@1.2.0-beta.1`, and `expo-desktop-template-bare-minimum@54.81.1-beta.6`. Creation and native generation already delegate to Expo Desktop; Metro and the development terminal delegate to Expo CLI.

The next useful delegation is standard desktop compilation and binary launching. spark should keep module selection, runtime compatibility, runtime registration, sidecar packaging, and session identity. No spark-specific upstream flags should be necessary.

## Reproduction

On macOS, first build the Kitchen Sink development binary using the normal framework workflow. Then run:

```sh
bun scripts/probe-expo-desktop-run.ts
# Or pass an existing compatible .app:
bun scripts/probe-expo-desktop-run.ts /absolute/path/to/KitchenSink.app
```

The probe uses the installed upstream CLI in a disposable project with the Kitchen Sink dependency graph. It intercepts `open` and `osascript`, so it neither launches the native app nor terminates another application. It kills the probe's process group after reaching the launch boundary or after 60 seconds. Logs and a report are written to `.spark/expo-desktop-run-probe`; the report identifies the retained temporary project. The second phase requires the Kitchen Sink's generated Xcode metadata, which it copies without Pods or build products.

Both phases invoke:

```sh
expo-desktop run macos <project> --binary <app> --no-install --no-bundler --no-single-instance
```

Observed with beta.6 on 2026-09-16:

| Case | Result |
| --- | --- |
| JavaScript-only project, existing binary | Creates `macos`, then fails during implicit prebuild: `Expected windows to have been filled in earlier by ensureConfigAsync()` |
| Existing Xcode metadata, existing binary | Starts Metro despite `--no-bundler`, then calls `open --background --new <app>` |

Exit 143 in the second phase is the harness stopping the process group after recording launch, not an upstream launch failure. This is an orchestration probe, not native app acceptance. The separately run Kitchen Sink build and four desktop-foundation probes passed using the upgraded dependencies.

## Requested upstream contracts

1. **Binary launch without a native project.** Take the binary branch before `ensureNativeProjectAsync` and Xcode project/scheme resolution. Read launch identity from the binary. A JavaScript-only app using a prebuilt runtime should not need prebuild, CocoaPods, or Xcode project metadata. The macOS-only prebuild assertion is also worth fixing independently.
2. **External Metro ownership.** Respect `--no-bundler` even for Debug. `resolveOptionsAsync` currently forces `shouldStartBundler` for explicit Debug, which the command supplies by default. Allow the launcher to target an already-running session: `--port` currently cannot be combined with `--no-bundler`. spark already has the actual Metro URL from Expo, including port and bundle options.
3. **Launch context and lifecycle.** Provide a generic interface for app arguments/environment and stopping the launched instance. spark currently supplies `-RCT_jsLocation`, `SPARK_BUNDLE_URL`, and project environment, and owns the native child process. The current `open` launch does not supply these settings or expose an owned process. Default bundle-ID-wide termination also needs a per-instance alternative for projects sharing a prebuilt runtime; `--no-single-instance` avoids the termination but does not provide lifecycle ownership.
4. **Build without launching.** Add a macOS build-only mode with a reliable artifact path. spark needs to finalize/package/register the output before deciding whether to launch. The current macOS command combines these steps; `--output` alone does not separate them.
5. **Windows equivalents as its run command matures.** Apply the same separation between build, binary launch, and session management. Source inspection shows Windows still ensures a native project and performs autolinking on its binary path. Native Windows acceptance must be done on Windows; this spike does not claim it.

A supported programmatic interface would suit session ownership better than accumulating CLI flags, but either interface can work. The acceptance case is two JavaScript-only projects opening the same compatible runtime against different existing Metro sessions, with reload and independent shutdown, without generating or compiling native projects.

## Adoption sequence

- Keep the beta.6 dependency upgrade and current spark development scripts now.
- Delegate native compilation once upstream exposes build-only output, preserving spark's before/after steps.
- Delegate prebuilt launch once binary-only startup, connection context, and lifecycle are supported.
- Replace the Expo terminal patch when upstream exposes desktop actions/session hooks. The new run commands alone do not replace that patch.

This document is a local handoff draft; no upstream issue or message has been sent.
