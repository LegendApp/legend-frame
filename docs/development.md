# Developing the local prototype

## Build and launch Go

Run these commands from the framework directory. Choose external directories that do not already contain an app.

```sh
bun install
bun run pack:local
bun run legend create /tmp/MyLegendGo --packages artifacts/packages/manifest.json
bun run legend build --go --project /tmp/MyLegendGo
```

The build prints the `.app` location under the project's `.legend/products/go/` directory. This is a locally built SDK runtime, not a public signed/notarized distribution.

Create another app and pass that runtime path to its development session:

```sh
bun run legend create /tmp/MyLegendApp --packages artifacts/packages/manifest.json
cd /tmp/MyLegendApp
bun dev --go /tmp/MyLegendGo/.legend/products/go/MyLegendGo.app
```

Use the actual path printed by the build; the upstream template determines the product name. The CLI remembers the runtime path and launch target in `.legend/settings.json`. Metro defaults to port 19120; pass `--port` for another port. `--no-open` starts the session without launching a window.

Terminal actions: `s` switches targets or builds the custom runtime, `o` opens, `r` reloads, `j` requests the debugger, and `q` closes the processes owned by the session. A target switch starts another native process and may reset React state.

## Add native code

The local fixture is distributed in `artifacts/packages/` after packing. Use its content-hashed filename from `artifacts/packages/manifest.json` (the stable alias below is also available for a first installation). Install its tarball with ordinary Bun:

```sh
bun add /absolute/path/to/legend-framework/artifacts/packages/legend-apps-native-greeting-0.1.0-prototype.0.tgz
```

Import `getGreeting` from `@legend-apps/native-greeting` and render its returned string. The running CLI detects that Go lacks the native module and offers a custom build. Press `s` to build and switch. Future JavaScript edits Fast Refresh; native source/configuration changes need another build.

If the current custom binary is stale, press `s` to rebuild it, or run `legend build` and reopen it. `legend build --force` forces regeneration and compilation. Generated native directories are disposable: author native changes in packages/config plugins.

## Inspect and build production selection

```sh
bunx --no-install legend analyze
bun run build
```

`legend build --preview` builds the production module selection in Debug configuration. Launch its printed product path with `legend open <app> --port <metro-port>` against a running development server; it requests production JavaScript.

`analyze` bundles for macOS production and writes `.legend/selection-report.json`, including resolved source modules and reasons for native inclusion. `build --release` regenerates the selected native graph and produces an app with a JavaScript bundle that runs without Metro.

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
