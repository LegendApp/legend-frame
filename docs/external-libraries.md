# Integrated external libraries

The framework integrates external libraries without taking ownership of their APIs. Prefer imports from the original package and use its documentation. New framework wrappers should exist only when necessary for framework-specific behavior; native setup, version pinning, Go support and production pruning do not by themselves require a new JavaScript API.

Our documentation provides a shared place to discover integrations, with attribution and the desktop-specific setup and limitations. Upstream documentation remains the reference for upstream APIs. Compatibility patches stay explicit and separate from framework behavior.

| Library | Upstream import | Desktop integration |
| --- | --- | --- |
| [Margelo Runtimes](https://github.com/margelo/react-native-runtimes) | `@react-native-runtimes/core` | Independent Hermes workers; SDK pins and macOS patches; automatic Metro/host setup; Go inclusion and production pruning. See [Runtimes](runtimes.md). |
| [React Native WebView](https://github.com/react-native-webview/react-native-webview) | `react-native-webview` | macOS WebKit view; tested version supplied with the SDK. See [WebView integration](desktop-api-expansion.md#webview-and-sqlite). |
| [OP-SQLite](https://github.com/OP-Engineering/op-sqlite) | `@op-engineering/op-sqlite` | Native SQLite; tested version and production selection. See [SQLite integration](desktop-api-expansion.md#webview-and-sqlite). |

The existing `desktop/webview` export is a passthrough compatibility API. Prefer the upstream import for new code. The existing `desktop/sqlite` adapter adds `openDatabase(name)` for framework project-scoped storage; upstream database operations and types remain OP-SQLite's API. Neither adapter is a template for wrapping new libraries automatically.

Applications should declare libraries they import directly as dependencies and retain the SDK's tested version overrides. New starters already declare Runtimes. Installed native code is available in Go/dev builds; production selection follows reachable imports and required native dependencies. Check each integration page for its validated platforms and limitations.
