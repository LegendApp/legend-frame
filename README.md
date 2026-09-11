# Legend Framework

An experimental macOS framework on expo-desktop. The local prototype supplies a Go runtime with native menus and file dialogs, detects additional native dependencies, and builds a custom runtime or a reduced standalone app.

Apple Silicon macOS only. No packages or app binaries have been published. Node and Bun are development tools; application JavaScript runs in Hermes.

See [development instructions](docs/development.md) and the [implementation plan](docs/implementation-plan.md). Validation status is recorded in [prototype status](docs/prototype-status.md).

```sh
bun install
bun test
bun run typecheck
bun run legend sdk pack
```

The prototype CLI requires Bun. Native compilation requires full Xcode and CocoaPods. Running an already-built compatible Go runtime uses JS tooling only.

`legend package` prepares a Developer ID-signed, notarized ZIP using local Keychain credentials. See [packaging instructions and validation limits](docs/packaging.md).

For the locally built demonstration, the Go runtime is saved at `artifacts/runtimes/LegendGo.app` and the standalone app at `artifacts/demo/LegendHello.app`. See the development instructions for creating an external app from the local package manifest.

After the SDK has a registered Go runtime:

```sh
bun run legend create /tmp/MyLegendApp
cd /tmp/MyLegendApp
bun dev
# When ready to build a standalone app:
bun run build
```

Framework maintainers build and register Go once with `bun run legend sdk build-go`, or register an existing binary with `bun run legend sdk register /path/to/Go.app`. SDK archives and Go paths are discovered automatically for app development.
