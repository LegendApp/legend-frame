# Legend Framework

An experimental macOS framework on expo-desktop. The local prototype supplies a Go runtime with native menus and file dialogs, detects additional native dependencies, and builds a custom runtime or a reduced standalone app.

Apple Silicon macOS only. No packages or app binaries have been published. Node and Bun are development tools; application JavaScript runs in Hermes.

See [development instructions](docs/development.md) and the [implementation plan](docs/implementation-plan.md). Validation status is recorded in [prototype status](docs/prototype-status.md).

```sh
bun install
bun test
bun run typecheck
bun run pack:local
```

The prototype CLI requires Bun. Native compilation requires full Xcode and CocoaPods. Running an already-built compatible Go runtime uses JS tooling only.

For the locally built demonstration, the Go runtime is saved at `artifacts/runtimes/LegendGo.app` and the standalone app at `artifacts/demo/LegendHello.app`. See the development instructions for creating an external app from the local package manifest.
