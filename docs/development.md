# Developing the local prototype

## Create and develop an app

With the local SDK packed and a Go runtime registered, run from the framework checkout:

```sh
bun run legend create /tmp/MyLegendApp
cd /tmp/MyLegendApp
bun dev
```

`create` finds the local package manifest. `dev` discovers a registered Go runtime matching the SDK version and native module signatures, chooses an available port, and opens the app. Running a compatible Go binary invokes no native build tools. The CLI finds the app root when invoked from a subdirectory.

The running terminal shows the current runtime and available actions:

```text
Legend · MyLegendApp

● Running in Legend Go
  Fast Refresh enabled

o  Open app · r  Reload · j  Debugger
s  Change runtime · q  Quit
```

`s` changes the selected runtime. If a custom runtime needs compilation, the CLI offers `b` to build and open it. Native compilation begins only after that action. `q` closes processes owned by the session. Switching runtimes may reset React state. The selected target is remembered in `.legend/settings.json`.

The normal production command is:

```sh
bun run build
```

It produces a standalone `.app` and prints its location. `legend open` opens the last standalone product without requiring its path.

To prepare a signed, notarized distribution archive, run `bun run package` in a new starter, or `bunx --no-install legend package` in an existing app. First use discovers signing identities and configures a notarization Keychain profile. See [packaging](packaging.md) for setup, CI, and retry behavior.

## Prepare the local SDK (framework maintainers)

This setup is done once per local SDK, rather than for every app:

```sh
bun install
bun run legend sdk pack
bun run legend sdk build-go
```

`pack` produces local package archives and registers their manifest. `build-go` creates a managed SDK starter, installs the packed SDK, builds Go, and registers the result automatically. Repeating it refreshes local packages before checking whether the binary needs rebuilding. To build from an existing SDK starter, pass `--project /path/to/starter`.

An existing Go binary can be registered without rebuilding:

```sh
bun run legend sdk register /path/to/LegendGo.app
```

Packing also discovers the saved prototype binary at `artifacts/runtimes/LegendGo.app`, if present. Registration stores local paths under `~/.legend/`; it does not duplicate the binaries. Keep the registered binaries in place. Set `LEGEND_HOME` to isolate local registry state for testing.

Runtime selection checks SDK version, platform, architecture, and native signatures. Missing/deleted runtimes are skipped. A missing Go installation produces installation guidance, while additional native modules or native app configuration produce a custom-build prompt. Runtime downloads are not implemented in this local prototype.

## Advanced overrides

Normal app development needs no flags. These remain available for automation and diagnosis:

- `create --packages <manifest>`: use an explicit local SDK archive manifest.
- `dev --go <Go.app>`: register and use a particular Go runtime.
- `--project <directory>`: choose another application directory.
- `--port <number>`: require a specific port; otherwise the CLI selects a free port starting at 19120.
- `dev --no-open`: start the server without launching the app.
- `build --dev`: build a custom Debug runtime and remember it for the next `dev` session.
- `build --preview`: build the production native selection in Debug.
- `build --force`: force native regeneration and compilation for the selected mode.

The legacy `build --go` and `build --release` forms remain available, but bare `build` now means a standalone release.

## Add native code

The local fixture is distributed in `artifacts/packages/` after packing. Use its content-hashed filename from `artifacts/packages/manifest.json` (the stable alias below is also available for a first installation). Install its tarball with ordinary Bun:

```sh
bun add /absolute/path/to/legend-framework/artifacts/packages/legend-apps-native-greeting-0.1.0-prototype.0.tgz
```

Import `getGreeting` from `@legend-apps/native-greeting` and render its returned string. The running CLI detects that Go lacks the native module and offers a custom build. Press `b` to build and switch. Future JavaScript edits Fast Refresh; native source/configuration changes need another build.

If the current custom binary is stale, press `b` to rebuild it, or run `legend build --dev` followed by `bun dev`. `legend build --dev --force` forces native regeneration and compilation for a custom development build. Generated native directories are disposable: author native changes in packages/config plugins.

## Inspect and build production selection

```sh
bunx --no-install legend analyze
bun run build
```

`legend build --preview` builds the production module selection in Debug configuration. Launch its printed product path with `legend open <app> --port <metro-port>` against a running development server; it requests production JavaScript.

`analyze` bundles for macOS production and writes `.legend/selection-report.json`, including resolved source modules and reasons for native inclusion. `build` regenerates the selected native graph and produces an app with a JavaScript bundle that runs without Metro.

Only SDK native modules are pruned automatically. Unknown third-party native dependencies are retained. Add native-only requirements to `expo.extra.legend.include` in `app.json`, using package names. Set `expo.extra.legend.customRuntime` to require an app-specific binary even without additional modules. Extra native configuration/plugins also require a custom runtime.

The prototype supports static `app.json` configuration. Programmatic app configuration and additional app entrypoints need explicit implementation/validation before they are advertised as supported.

## Native prerequisites

`legend doctor` checks Apple Silicon macOS, Node, Bun, CocoaPods, Xcode, and the macOS SDK. Install full Xcode, complete its first-launch/license setup, and select it with the normal Xcode command-line tools settings. Command Line Tools alone cannot build the generated macOS application. Install CocoaPods in a supported Ruby environment and ensure `pod` is on PATH.

The CLI diagnoses missing tooling; it does not silently install Xcode or accept licenses. Re-run the build or switch after completing setup. No native prerequisites are invoked for a compatible prebuilt Go launch.

## Local package iteration

Repack after source changes. The archive manifest maps package names to local tarballs; starters use overrides so transitive framework packages also resolve locally. The archive manifest uses content-hashed filenames to avoid stale package-manager caches. Run `bun scripts/refresh-consumer.ts /path/to/app` from the framework repository to update an existing test consumer. Public package versions will be immutable.

Do not use workspace symlinks as the sole distribution test. The Go builder and consumer should install real tarballs outside both source repositories.

## Logs and generated outputs

- `.legend/commands.jsonl`: invoked build/install commands and working directories.
- `.legend/logs/`: full command output, including native build logs.
- `.legend/native-selection.json`: input shared by autolinking and codegen.
- `.legend/selection-report.json`: production selection explanation.
- `.legend/*-build.json`: product location and successful native fingerprint.
- `.legend/session.json`: current compatibility gate for the managed Metro session.

Keep generated files out of version control. Commit application source/configuration and its package-manager lockfile.
