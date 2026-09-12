# Expo Desktop integration handoff

Legend builds on Expo Desktop and currently targets Apple Silicon macOS. The
immediate goal is to reuse upstream project creation and launch conventions while
retaining Legend's desktop SDK and runtime compatibility checks.

## Local changes available now

- `packages/cli/templates/blank-typescript/` is the starter's source of truth. It
  ships inside the CLI archive, so creating an app outside the repository uses
  the same files. `create.ts` copies it, assigns app identity, resolves local SDK
  archives, and generates Expo config before installing dependencies.
- `bun start`, `bun run macos`, and `bun dev` all run `legend dev`. They use the
  same Metro session, runtime discovery, compatibility gate, and build/switch UI.
- Native generation still uses
  `expo-desktop-template-bare-minimum@54.81.1-beta.5` and Legend configuration
  plugins. There is no Legend fork of the native starter.
- Go contains the supported Legend SDK for its platform. App-specific native
  dependencies/configuration use a custom development build. Standalone builds
  select required SDK modules. Matching mobile Expo Go is not a release gate.

The starter is not published, and direct creation through
`expo-desktop create-app --template` has not been validated. `legend create`
remains the supported local entry point. No Windows runtime is supplied.

## Work to pair on with Jamie

### Make the starter directly usable through Expo Desktop

Compare the extracted starter with the beta `blank-typescript` template and
confirm the template extraction, package naming, and app-identity substitution
contract. Decide how to initialize app config and local archive resolution
without maintaining two scaffolders, including the pending desktop-config work. When packages are published,
verify direct template creation and `legend create` produce equivalent projects.
Keep the dependency matrix pinned until a newer matrix is tested.

### Define a generic prebuilt-binary launch contract

Proposed syntax, not an implemented dependency of Legend:

```sh
expo-desktop run macos --binary /absolute/path/to/LegendGo.app
```

Expo CLI already documents `--binary` for installing a prebuilt mobile binary:
https://docs.expo.dev/more/expo-cli/#compiling

For Legend's use, agree on and verify these behaviors:

1. Launch from a JavaScript-only app directory with no `macos/`, Xcode, CocoaPods,
   codegen, or implicit prebuild. Validate on a machine without native tooling.
2. Connect to the intended Metro server and port, including reusing a server
   managed by Legend. Establish one owner for starting/stopping Metro.
3. Support a generic way to deliver launch arguments/environment or a connection
   URL. Legend passes a bundle URL and React Native's packager location.
   The pending desktop-config work also supplies project identity/window options.
4. Preserve the exact requested binary path, expose launch failures, and define
   process ownership/termination so switching targets or stopping stale code
   cannot affect an unrelated app session.
5. Exercise Fast Refresh, reload, custom-build switching, and two projects using
   the same Go binary against different Metro ports.

Legend should resolve/cache the appropriate binary and check its native metadata
before asking the upstream launcher to run it. Binary location is not part of the
contract: registered local paths, a future download cache, and package-local
binaries should all work. No Legend-specific flag is needed upstream.

### Replace local plumbing after the contract is proven

Keep `legend dev` as the managed development entry point. Replace its launch
implementation with upstream delegation once the scenarios above pass. Reuse
upstream native build commands where they can preserve module selection,
build invalidation, and diagnostics. Windows can follow with its own validated
runtime, capability matrix, and launch implementation.

## Where to start reading

- `packages/cli/src/create.ts` and `packages/cli/templates/blank-typescript/`:
  project creation and dependency pins.
- `packages/cli/src/dev.ts`: Metro ownership, runtime checks, launching, switching,
  and process cleanup.
- `packages/cli/src/local.ts`: runtime discovery and local SDK registration.
- `packages/cli/src/project.ts`: native signatures and compatibility.
- `packages/cli/src/build.ts`: module selection, upstream prebuild, and compilation.
- `packages/config-plugin/` and `packages/desktop-host/`: configuration and host.
- `docs/development.md`: local setup and workflows.

Start with `bun install`, `bun run typecheck`, and `bun test`. To exercise the
packed consumer flow, run `bun run legend sdk pack`, register/build Go as described
in the development guide, create an app outside the checkout, and run
`bun run macos`. Native build verification is a separate prerequisite-heavy step.

## Local validation (2026-09-12)

An isolated copy with freshly installed dependencies passed TypeScript checking
and all 115 Bun tests (439 assertions). The CLI and SDK were packed into real
archives; an external consumer with spaces in its directory name was created
from those archives and passed its own TypeScript check. Its `macos` script
started the managed session and Metro, reported the missing Go runtime in the
isolated registry, and exited through `q`. Creation generated app identity and
Expo config, preserved the ignore file, and did not generate a native project.
The equivalent `start`/`dev` script targets were checked in the generated manifest.

The source checkout had unresolved dependency errors before installation; checks
ran in the isolated copy. Older saved SDK archives lacked the ongoing Runtimes
integration, so the successful consumer check used freshly packed SDK archives.
No native app launch/build, direct Expo Desktop template creation, or proposed
upstream `--binary` behavior was exercised by this change.

## Commit isolation

The standalone template commit retains the committed starter's Expo `app.json`
configuration and Metro gate. Desktop configuration, expanded SDK dependencies,
and background-runtime integration remain separate work; their current working
copies are preserved as extensions to the extracted template. The template
commit does not require those uncommitted additions.

The isolated commit snapshot passed TypeScript checking and its 24 existing Bun
tests (97 assertions). Its packed CLI created an external app which installed,
passed TypeScript checking, and started the managed Metro session through
`bun run macos --no-open`. The earlier 115-test result above covers the broader
in-progress SDK checkout, not the contents of this standalone commit.
