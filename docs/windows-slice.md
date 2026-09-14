# Windows development support

Windows development is integrated into the Legend CLI, starter, config plugin, host package, runtime registry, native compatibility checks, and Metro session. There is no separate client toolkit or source ZIP to install.

The current scope is Go and custom development builds on Windows x64. The Windows starter exercises the native host without installing the macOS SDK feature set. The existing `@legend-apps/native-greeting` fixture has a Windows implementation for testing the transition to a custom build. Production builds, packaging, the full desktop SDK, and secondary JavaScript runtimes remain outside this slice.

**Validation:** typechecking, repository tests, packed Windows starter creation, repeated prebuild, development bundles, and native graph invalidation have passed on macOS. Windows native compilation, autolinking, launch, Hermes execution, and Fast Refresh still need a Windows run. A successful JavaScript bundle does not establish native support.

## Set up the Windows machine

Use Windows 11 x64 with an interactive desktop, Node.js 22 or 24, Bun 1.3.14+, Git, PowerShell 7 (`pwsh.exe` on PATH), and the React Native Windows native prerequisites. The pinned RNW 0.81.35 template uses **Visual Studio 2026 / MSVC v145**. Its prerequisite script checks VS 18.6.1+, .NET SDK 10, and the Windows 11 SDK 22621 component; an older VS 2022-only installation does not match this template. See [RNW environment setup](https://microsoft.github.io/react-native-windows/docs/getting-started).

Use this repository normally. From its root in PowerShell:

```powershell
bun install
bun run legend sdk pack --platform windows
bun run legend create C:\dev\LegendWindowsApp --platform windows
cd C:\dev\LegendWindowsApp
```

Windows is the default creation target when running on Windows; the explicit flag also allows generating a Windows project on macOS. Keep generated apps outside OneDrive and use a short path. Install dependencies on Windows instead of copying macOS `node_modules`.

The packed SDK contains the CLI, host hooks, config plugin, templates, and native fixture. Windows SDK packing skips preparing the macOS-only secondary-runtime patch and preserves any existing archive entry for it. No additional source kit is needed.

Check the native prerequisites using the script shipped with the pinned RNW version:

```powershell
pwsh -File node_modules/react-native-windows/Scripts/rnw-dependencies.ps1
```

It checks by default; `-Install` installs missing prerequisites from an elevated terminal. Restart your terminal after installation so tools are on PATH.

## Normal framework workflow

Inside the generated app:

```powershell
bunx --bun legend sdk build-go --project .
bun run windows
```

`windows`, `dev`, and `start` use the same `legend dev` implementation. Go is saved under `.legend/products/go`, with `.legend/go-build.json`, and registered in the normal Legend runtime registry. Registry discovery checks the platform and architecture so a macOS runtime cannot be selected for Windows.

Edit `App.tsx` to test Fast Refresh. Click the counter first and confirm it retains its value after a text edit. The native window title uses the current project's launch identity even when Go was built from another starter. Other desktop window options and SDK features have not been ported by this slice.

Use the existing session commands: `o` opens, `r` reloads, `j` opens the debugger when supported by RNW/Expo, `s` switches between Go and a custom development build, `b` builds when required, and `q` exits. Adding a supported native dependency or changing its native source invalidates an incompatible runtime; the session stops its owned app and offers a development build.

A direct custom build uses the same command as macOS:

```powershell
bunx --bun legend build --dev
bun run dev
```

Windows `legend build` without `--dev`, preview builds, and distribution packaging are intentionally unsupported. Native compilation must run on Windows x64. The selected target is stored in `desktop.config.json` as `"platforms": ["windows"]`; subsequent commands read that configuration. This version supports one desktop target per generated project.

For a reusable generic SDK Go runtime, run from the framework checkout:

```powershell
bun run legend sdk build-go --platform windows
```

This uses the platform-specific SDK build directory and the same runtime registry. Apps created against the matching packed SDK discover it automatically.

## Automated native verification

From the framework checkout, after packing the SDK and installing native prerequisites:

```powershell
bun run test:windows --project C:\dev\LegendWindowsVerification
```

Choose a fresh destination. The verifier calls the real starter, builds Go through `legend sdk build-go`, and launches the installed CLI's `legend dev` session. It checks the compiled native host identity and Hermes, edits a file to test Fast Refresh, installs the existing `native-greeting` fixture, waits for the shared session to reject Go, then sends the normal `b` command and checks the custom native greeting. It also checks that building custom did not change the saved Go executable.

Keep the desktop session unlocked. Native compilation and initial NuGet downloads can take several minutes. The verifier exits nonzero on failure. It installs a native fixture, so use a new destination for a complete second run.

Send back these generated files if it fails:

- `.legend/windows-verification.json`: completed stages, native reports, and the failing stage.
- `.legend/commands.jsonl`: commands and working directories.
- `.legend/logs/`: build and Metro diagnostics, including `windows-session.log` and MSBuild logs.

If the GUI exits without console output, also include any error dialog or Windows Event Viewer application error. A build success alone is not a passing verification.

Generation and both Windows development bundles can be checked on macOS through the same framework code:

```sh
bun run legend sdk pack --platform windows
bun run test:windows:prepare --project /tmp/LegendWindowsCheck
```

This mode explicitly reports that native execution was not verified. RNW platform discovery may log that Windows PowerShell is unavailable on macOS; the project's platform declaration still lets Metro select the Windows sources.

## Known issues

Track missing implementations, safe placeholders, and native acceptance in [known Windows issues](windows-issues.md). Windows stays in shared screens; a missing UI implementation must not fail during import or render.

## Implementation and next steps

The CLI's Windows build adapter uses the shared build lock, runtime schema, native graph, build records, registration, and development session. `@legend-apps/desktop-config` installs the Windows hooks from `@legend-apps/desktop-host/windows`. The host embeds the same runtime metadata written to the build record. Native packages use RNW's ordinary autolinking pipeline.

The development solution excludes the packaging project. The app uses `WindowsPackageType=None` and `WindowsAppSDKSelfContained=true`, following Microsoft's [unpackaged Windows App SDK guidance](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/self-contained-deploy/deploy-self-contained-apps). The entire native output directory is retained so its DLLs accompany the executable. These are Debug builds for a configured developer machine; compiler-free distribution to clean machines remains unverified.

The framework detects supported Windows native packages and rejects directly installed native dependencies without a Windows implementation. This does not establish support for every third-party dependency graph or arbitrary native project customization. The macOS SDK remains available through the macOS starter while its Windows modules are ported incrementally.

No upstream Expo Desktop change is needed to attempt this. Jamie can help if the native verification exposes a Windows bootstrap/prebuild problem, and later with the shared `expo-desktop run windows --binary` contract. The Windows report provides a concrete reproducer for that work.

## Application examples and host integration

The [small examples](example-apps.md) are integrated universal projects. The latest
host source adds secondary RNW Composition windows on the same ReactNativeHost,
close/quit guards, focused shortcuts, basic Win32 menus, main-window geometry,
queued/warm open events, and project-scoped AsyncStorage configuration. Music Lite
adds MediaPlayer playback. These are source implementations pending a Windows
build and interaction check; see WIN-09 and WIN-10.

The examples retain Expo Desktop beta generation. No separate Windows source kit
is required. After updating SDK archives, rebuild the Windows Go/custom client:
old binaries cannot expose the new host hooks or audio module. Native package
sources ship in their SDK archives.
