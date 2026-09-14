# Developing the local prototype

## Create and develop an app

With the local SDK packed and a Go runtime registered, run from the framework checkout:

```sh
bun run legend create /tmp/MyLegendApp
cd /tmp/MyLegendApp
bun run macos
```

`bun run macos`, `bun start`, and `bun dev` run Expo CLI's development terminal with Legend desktop actions. Existing apps can use `"macos": "legend dev"` and `"start": "legend dev"`; the small Legend supervisor starts the installed `expo start` with inherited terminal input/output. Expo owns Metro, prompts, reload, debugging, logs, and its mobile/web keys.

`create` delegates template extraction, identity assignment, and installation to Expo Desktop beta. `dev` discovers a compatible registered Go runtime, chooses an available localhost port, and opens the app after Expo is ready. Running compatible Go invokes no native build tools. Use `--no-open` to wait for a desktop launch key instead.

Expo's command table adds:

```text
› Press d │ open macOS (Legend Go)
› Press g │ switch desktop to development build
› Press b │ build and open macOS development build
```

On Windows, the actions target Windows. They are disabled when the target cannot run on the host. `g` switches between Legend Go and a custom development build; it never compiles automatically. `b` becomes available when a custom build is required. Switching binaries can reset React state. Selection is remembered in `.legend/settings.json`.

Expo retains `r` for reload, `j` for debugging, `m` for the dev menu, `w` for web, `o` for your editor, and `s` for the **mobile** Expo Go/development-client switch. `?` shows the current command table. **Ctrl+C** exits Expo and closes the native app owned by this session. Metro output appears directly in the terminal; native build logs remain in `.legend/logs/`.

The extension uses a process-local patch to `@expo/cli@54.0.27`, verified against the exact upstream source before startup. It does not modify installed Expo files or affect ordinary `expo start` calls. See [Expo Desktop integration](expo-desktop-integration.md#expo-development-terminal-patch) for patch maintenance.

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

Use Node **24.19.0**, pinned in the checkout's `.nvmrc` (`nvm install && nvm use`). Node 24.12.0 fails to import `AndroidConfig` / `IOSConfig` from Expo's generated CommonJS modules when running Expo Desktop beta. Create/prebuild and the native doctor check the installed Expo Desktop config exports with the actual Node executable on PATH, so incompatible runtimes fail before native generation. This check does not patch Expo or change the Expo Desktop beta pin.

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

## Starter template and Expo Desktop integration

Edit the complete templates under `packages/cli/templates/`: `blank-typescript` (macOS), `windows`, or `universal`. Their manifests own dependency pins and scripts. `legend sdk pack` resolves local SDK archives into template dependencies and emits npm tarballs plus `artifacts/packages/templates.json`. Repack after changing a template or SDK package.

`legend create` invokes `expo-desktop@1.0.0-beta.5 create-app --template <archive>`. Expo Desktop validates the directory/name, extracts files, assigns app/native identity, installs dependencies, and initializes Git. A template postinstall initializes Legend's configuration once. It does not overwrite an existing project ID or user edits. Project basenames must be alphanumeric, following upstream validation; spaces in parent directories are supported.

Direct Expo Desktop template creation is also checked by `bun run test:templates`, including a consumer outside the checkout. These local archives reference local SDK tarballs; they are not a published package distribution. The [integration handoff](expo-desktop-integration.md) documents the npm compatibility pin and remaining build/launch limitations.
