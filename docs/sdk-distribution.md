# Transferable SDK and prebuilt development clients

A developer can install this SDK without the framework checkout. The distribution is a directory containing immutable package archives, a manifest, SHA-256 checksums, an installer, and optionally prebuilt Legend Go clients. Public npm publication and a hosted download service are not required for internal testing.

## Produce a bundle

```sh
bun run pack:local
bun run legend sdk build-go
bun run legend sdk export /path/to/LegendSDK \
  --runtime /path/to/LegendGo.app
```

On Windows, build Go with `legend sdk build-go --platform windows`, then pass its entire `LegendWindows` product directory to `sdk export --runtime`. Keep all DLLs beside `MyApp.exe`. The runtime option can repeat to include clients for both platforms. Exports refuse to overwrite existing output and publish the destination only after checksums and metadata pass.

The maintained Go profile includes `/ui`, Clipboard, SecureStore, Linking, and file dialogs. On macOS it also contains the broader desktop starter SDK and Expo JSON utilities used in universal development dependency graphs. Explicit `sdk build-go --project ...` builds preserve the supplied project’s chosen module set.

The SDK uses the existing pinned Expo Desktop beta matrix. Package dependencies and overrides are resolved to paths on the recipient machine immediately before Expo Desktop creates the application. Packed templates contain no producer-machine absolute paths. The source checkout's local development workflow continues to work.

## Install on another machine

Transfer the directory while preserving file contents, executable permissions, and symlinks. On macOS, archive it with `ditto -c -k --sequesterRsrc --keepParent LegendSDK LegendSDK.zip`; extract before installing. Download and transfer through your existing trusted internal channel.

With Bun 1.3.14 or later and Node installed:

```sh
cd /path/to/LegendSDK
bun install.ts
# The installer prints the exact installed CLI command:
bun .cli/node_modules/@legend-apps/cli/src/index.ts create /path/to/MyApp --universal
# Or create the complete example:
bun .cli/node_modules/@legend-apps/cli/src/index.ts create /path/to/MyEditor --example document-editor
```

The installer verifies package/client contents before installing its isolated CLI and registering the SDK and Go clients. It still needs network access for pinned third-party npm dependencies. Checksums detect corruption; they are not a publisher signature.

Keep the installed SDK directory in place: applications reference its immutable archives, and the Go registry references its clients. It can be relocated **before installation**. After moving an installed SDK, rerun its installer and refresh application package paths before installing dependencies again. This is a portable internal distribution, not yet registry-independent project manifests or an automatic SDK updater.

Inside the app, `bun run macos` or `bun run windows` discovers a matching registered Go client. The existing compatibility gate rejects a client with different native signatures. Installing new native dependencies still requires a development build and the native toolchain. Mobile native builds remain Expo workflows.

Prebuilt clients are development executables, not signed production releases. A Windows client must be produced on Windows; macOS cannot cross-compile it. Windows clean-machine startup and redistribution remain explicit acceptance items.

## Recorded checks

A freshly exported SDK was moved to a different directory, installed under a separate Legend registry, and used to create an app outside the checkout. Its dependencies point exclusively to the recipient SDK. Unit tests cover relocation, altered archives, and escaping symlinks. A current macOS Go client was built, exported, registered from the transferred SDK, and used to launch the recipient app in Hermes without a native build. The installed SDK also created the complete document-editor example, whose consumer TypeScript check passed.
