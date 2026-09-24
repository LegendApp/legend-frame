# Desktop API structure review

Status: historical proposal, 2026-09-13. The subsequently agreed universal, Expo-aligned direction is captured in the [universal API plan](universal-api-plan.md). That plan supersedes this document's desktop-first ownership and migration recommendations; the source inventory remains useful. This exercise audits the current SDK and recommends its next API changes; it does not implement them. The baseline is the [public export map](../packages/desktop/package.json), the feature packages linked below, and the [external-library policy](external-libraries.md). Windows currently has an integrated development host, not implementations of the full desktop SDK; see [Windows development](windows-slice.md).

## Recommendation

Own a focused native desktop API. Borrow established names and behavior where they fit, expose React lifecycle helpers separately, and integrate good external libraries through their original APIs. Select implementations per capability, including Expo modules when their desktop implementation and total cost justify them. Neither potential Expo adoption nor permanent independence requires copying Expo's public API today.

Electron and Tauri are useful references for windows, menus, dialogs, shortcuts, and OS integration. React Native supplies the rendering and component model. Node is a useful vocabulary reference for filesystem and process operations, but promising Node compatibility would create a much larger runtime contract.

The current native code is a reasonable starting point for most desktop capabilities. That is a recommendation based on fit and existing integration, not a measured claim that it outperforms alternatives. Replacing working native behavior with a wrapper around another incomplete desktop implementation has no demonstrated benefit.

## Capability decisions

“Keep” means retain ownership and the implementation direction, not freeze every current signature. Each row accounts for a current SDK subpath unless explicitly marked as an external integration.

### App, windows, and desktop interaction

| Current API and source | Decision | Proposed contract and reason |
| --- | --- | --- |
| `app` — [desktop-app](../packages/desktop-app/src/index.ts) | Keep, tighten | Keep app identity, activation, quit, launch events, and quit guards. Replace catch-all event shapes with discriminated unions. Move raw native dispatch out of the ordinary public API. This is host behavior that spark must coordinate with Go and custom apps. |
| `windows` — [desktop-windows](../packages/desktop-windows/src/index.ts) | Keep, adapt | Keep window creation and operations. Add an explicit handle for a window ID and root-bound current-window identity. Standardize bounds and platform options before adding Windows implementations. Window content remains a React Native root. |
| `menus` — [native-menu](../packages/native-menu/src/index.ts) | Keep native implementation; redesign item model | Introduce shared item types, semantic roles, portable accelerators, and stable IDs. Preserve ownership and native standard actions. Cocoa modifier masks and localized title matching should become internal compatibility details. |
| `context-menu` — [context-menu](../packages/context-menu/src/index.ts) | Keep entry point; share menu model | Reuse menu items and explicitly identify the owning window/view and coordinate space. A popup operation does not need a separate menu language. |
| `tray` — [tray](../packages/tray/src/index.ts) | Keep | Keep disposable tray handles and updates; share menu items. Separate portable image inputs from macOS symbol conveniences. Tray popovers can be a later native-view feature. |
| `shortcuts` — [desktop-shortcuts](../packages/desktop-shortcuts/src/index.ts) | Keep | Window-scoped shortcuts are distinct from OS-global registration. Share accelerator parsing with menus, specify focus routing, and retain disposable registration. |
| `global-shortcuts` — [global-shortcuts](../packages/global-shortcuts/src/index.ts) | Keep separate | Preserve explicit registration failures and conflicts. A global shortcut should never silently become a local shortcut when registration fails. |
| `drag-drop` — [drag-drop](../packages/drag-drop/src/index.tsx) | Keep React Native component model | Native source/target components with typed file, URL, and text payloads fit the renderer. Do not impose DOM drag events. Add file promises or streaming only for a concrete application need. |

Borrow recognizable operations such as show, hide, minimize, maximize, set title, and set bounds from [Electron's native window API](https://www.electronjs.org/docs/latest/api/base-window). Keep spark's React root and window-props model instead of introducing browser content objects. A handle is an ergonomic addition over existing ID-based commands; it does not require rewriting the native manager.

For menus, [Tauri's menu API](https://v2.tauri.app/reference/javascript/api/namespacemenu/) is a useful reference for item categories and predefined native actions. spark should define one shared tree with normal items, separators, checkboxes, submenus, and standard roles. Individual surfaces can reject unsupported features explicitly. Application menus, context menus, tray menus, and the current Dock menu should all consume that tree. Standard edit actions must target the focused native responder, rather than being simulated with clipboard calls.

### Files, dialogs, storage, and clipboard

| Current API and source | Decision | Proposed contract and reason |
| --- | --- | --- |
| `files` — [file-system](../packages/file-system/src/index.ts) | Keep backend; consolidate filesystem ownership | Keep explicit text/base64 operations initially. Define path, overwrite, symlink, directory, and watch behavior before making signatures more Node-like. Add efficient byte/chunk APIs when consumers need them. |
| `dialogs` — [file-dialog](../packages/file-dialog/src/index.ts), [message-dialog](../packages/message-dialog/src/index.ts) | Keep; normalize | Make this the canonical dialog entry point. Use consistent owner-window options, selection/filter vocabulary, and structured outcomes. Move filesystem operations out. |
| `message-dialog` | Deprecate duplicate entry point | Reexport through `dialogs` during migration; it already exposes these operations. Preserve native message-box behavior. |
| `settings` — [settings](../packages/settings/src/index.ts) | Keep small pluggable store | JSON settings are sufficient for preferences. Keep injected storage support. Add subscription semantics before offering a settings hook; do not imply cross-runtime transactions from the current per-store update queue. |
| `secure-storage` — [secure-storage](../packages/secure-storage/src/index.ts) | Keep OS-backed secrets contract | Keep string key/value storage and project scoping. Define missing values, access failures, and OS-specific options. Port the backend to the selected Windows credential facility. |
| `clipboard` — [clipboard](../packages/clipboard/src/index.ts) | Keep rich contract; evaluate community backend | Current functionality includes text, HTML, RTF, PNG, and file lists. Judge a replacement against these formats on each desktop platform, not text-only sample code. |
| `sqlite` — [sqlite](../packages/sqlite) | Keep only project-path convenience | `openDatabase(name)` adds framework-specific storage placement. Return upstream OP-SQLite objects; keep queries, transactions, and database types upstream-owned. |

The existing file-dialog API duplicates file reads/writes and exposes `revealInFinder`. Those belong in `files` and an OS-opening API respectively. Its `writeTextFileIfUnchanged` has distinct behavior: move and preserve that operation rather than aliasing it to unconditional `writeText`.

Normalize file dialogs around `defaultPath`, `filters`, `multiple`, and explicit selection mode, with `windowId` for ownership. Take familiar concepts from [Electron dialogs](https://www.electronjs.org/docs/latest/api/dialog), while defining exact spark semantics. Proposed results are `{ canceled: true }` or `{ canceled: false, paths: [...] }` for open, and the analogous single `path` for save. Unsupported features and malformed native responses must reject, not appear as cancellation.

Do not advertise `node:fs` compatibility. The current `stat` returns a small record, `mkdir` defaults to recursive, `remove` returns a boolean, and `copy`/`move` use Foundation behavior. Those differ from the contracts and types in [Node's filesystem API](https://nodejs.org/api/fs.html). Use familiar names only when their semantics match; introduce a compatibility package later if an actual migration requires it. Base64 over JSON is a transport limitation, not the desired permanent binary API.

Two external candidates deserve bounded investigation:

- [Community Clipboard](https://github.com/react-native-clipboard/clipboard) advertises macOS and Windows support. Inspect its native format coverage and compatibility with our pinned React Native versions before deciding whether adopting or contributing to it is cheaper than maintaining our backend. The README alone does not establish parity with our rich clipboard.
- The inspected [React Native FS fork](https://github.com/birdofpreyru/react-native-fs) lists Mac Catalyst and Windows. Catalyst support does not establish compatibility with our React Native macOS/AppKit host. It is not yet a demonstrated replacement.

Expo modules should pass the same evaluation. For example, [Expo SDK 54 SecureStore](https://docs.expo.dev/versions/v54.0.0/sdk/securestore/) does not document our macOS/Windows target pair as supported platforms. Its familiar API alone is not a reason to replace the existing Keychain backend. Assess a concrete desktop implementation, dependency graph, maintenance burden, and migration benefit before adopting it.

### OS integration, execution, and optional libraries

| Current API and source | Decision | Proposed contract and reason |
| --- | --- | --- |
| `links` — [desktop-links](../packages/desktop-links/src/index.ts) | Separate OS opening from document activity | Put opening URLs/paths and revealing files together. Keep incoming file/URL events and recent-document operations in an app/document boundary. Preserve queued launch-event delivery. |
| `notifications` — [notifications](../packages/notifications/src/index.ts) | Keep local native notifications | Keep explicit permission requests, scheduling, delivery, and response events. Push transport would be an independent integration. Define identifiers and capability differences before porting. |
| `updates` — [updates](../packages/updates) | Keep platform adapter | Retain Sparkle for macOS application updates. Shared state/events may span platforms; Windows installation and relaunch behavior need their own backend. Do not describe this as JavaScript OTA updates. |
| `processes` — [processes](../packages/processes/src/index.ts) | Keep explicit subprocess API | Retain executable/argument separation, bundled-helper resolution, and disposable process ownership. Document buffering, cancellation, and child lifetime. Add streaming/backpressure or PTY support separately when needed. |
| `system` — [system](../packages/system/src/index.ts) | Split by responsibility | Separate system information/events, power management, login startup, and Dock behavior. Keep platform-specific facilities explicit. Sharing a native implementation initially is fine. |
| `webview` — [webview](../packages/webview) | Prefer upstream import; deprecate branding-only facade | Use `react-native-webview` directly. Make installation optional; decide Go inclusion independently. WebView remains an optional view, not the host architecture. |
| Runtimes — [integration](runtimes.md) | Keep upstream API, opt-in dependency | Use `@react-native-runtimes/core` directly for independent Hermes workers. Integration includes Metro/host setup and pinned patches. Do not present workers as Node processes or an OS background service. |
| Camera — [prototype](camera-prototype.md) | Continue external-library approach | Keep the upstream component/API and explicit compatibility patches. It remains a prototype, outside the ordinary desktop SDK export map. |

[Sparkle](https://sparkle-project.org/) is specifically a macOS application-update framework. Keeping it is a backend choice, not a claim that one updater library solves both desktop platforms. Similarly, the present subprocess implementation provides direct children and buffered output, not the full Node process/stream environment.

## Shared contracts to settle first

1. **Availability and errors.** Distinguish unsupported platform, missing native module/custom-build requirement, permission denial, invalid input, and operational failure. Provide capability discovery that is safe without loading optional modules. Several current specs call `TurboModuleRegistry.getEnforcing` at import time, so a later `Platform.OS` check cannot reliably protect an unsupported import. Permission state must remain separate from capability availability.
2. **Paths and coordinates.** Specify native absolute paths and explicit file-URL conversion, including Windows drive/UNC paths. Current slash-based validation is macOS-specific. Use logical desktop units for window bounds with a documented origin and multi-display behavior; native adapters translate. Existing macOS bottom-left frames require an explicit migration, not a silent reinterpretation. View-relative popup coordinates need their own type/context.
3. **Ownership and disposal.** Standardize idempotent `.remove()` on subscriptions and registrations, including asynchronous cleanup. Every window-scoped resource needs an explicit owner. Document which resources survive a React unmount, a closed window, a reload, and a worker exit.
4. **Typed native boundaries.** Move generic `call(method, JSON)` and unstructured event transport behind typed internal contracts. Validate native replies and use stable error codes. This can be incremental; changing bridge technology is not a prerequisite.
5. **Platform extensions.** Keep portable options at the top level and named platform-specific options for materials, traffic-light positioning, Dock features, and similar facilities. Portability does not mean reducing both platforms to the smallest common feature set.

Project-scoped paths and keys support Go coexistence; they are not a security sandbox. These proposals do not introduce Electron renderer privileges or Tauri's permission model implicitly.

## React layer

Keep commands usable outside React. Offer hooks from feature-specific React entry points so importing one helper does not load all optional modules. Proposed names below are illustrative, not implemented exports.

| Helper | Responsibility | Prerequisite |
| --- | --- | --- |
| `useCurrentWindow()` | Stable handle for the React root's owning window | Root context; never infer ownership from the globally focused window |
| `useWindowState(window, selector)` | Subscribe narrowly to window state | Coherent initial snapshot/event handoff; no missed updates |
| `useWindowEvent(window, event, handler)` | Own a listener and call the latest handler | Typed events and reliable disposal |
| `useBeforeWindowClose(handler)` | Register the current root's close guard | Clear behavior for multiple guards, pending decisions, and errors |
| `useShortcut(accelerator, handler, options)` | Own a local shortcut registration | Stable owner, async registration cleanup, conflict/error reporting |
| `useNativeMenu(...)` | Maintain menu contributions and handlers | Shared menu model; avoid rebuilding native menus for handler identity changes |

The existing `useNativeMenu` is the starting point, but currently reruns its effect when handler/menu identities change. Separate callback freshness from structural menu changes. Hooks that register asynchronously must dispose a registration that completes after unmount; they must expose readiness/failure rather than silently catching errors. Development remounts should not leak native resources.

Defer `useSettings` until settings have observable updates, a defined initial-loading state, and an explicit cross-window/runtime consistency policy. Do not invent `useReadFile`, `useShowDialog`, or a hook for every command: commands can run directly from event handlers. App-wide menus, tray items, and services also need imperative ownership outside a particular screen's lifetime.

## Dependency cost is a separate design axis

Today the [desktop package](../packages/desktop/package.json) directly depends on all feature packages, Runtimes, and Nitro. WebView and SQLite come through its wrapper dependencies. Subpath imports help select JavaScript/native features, but do not make package installation optional.

| Cost boundary | Recommended treatment |
| --- | --- |
| npm installation | Make large external integrations explicit application dependencies; keep the starter's default set intentional. Choose optional-peer or separate-package mechanics with the resolver/autolinker, not only TypeScript exports. |
| JavaScript loading | Keep narrow subpaths and avoid an eager all-features barrel. Capability checks must not import unavailable implementations. |
| Generic Go binary | Maintain an explicit curated native module set. Go may supply an optional library without forcing every app to depend on it. |
| Custom development build | Honor the installed native dependency graph and compatibility metadata; do not equate an unused JS import with absence from the binary. |
| Production binary | Continue reachability-based native selection and report retained dependencies. Many feature pods depend on `RNDesktopApp` for shared helpers/events; splitting JS entry points alone cannot remove native linkage. |
| Expo tooling versus runtime | Audit CLI/prebuild/Metro dependencies separately from linked Expo modules. Removing an Expo-facing API does not automatically remove Expo infrastructure or its cost. |

A best-implementation decision should record supported desktop behavior, native dependencies, platform adaptation required, upstream maintenance, and migration cost. Measure size/startup/performance when they decide between credible candidates; this review supplies no comparative benchmark. A platform-specific backend can be the best implementation even when the public contract is shared.

## Concrete migration order

1. **Define shared contracts:** errors/cancellation, safe capability discovery, paths, coordinates, ownership, and typed events. These determine how every Windows backend should behave.
2. **Fix boundaries with minimal churn:** make `dialogs` canonical; move duplicate file operations to `files`; introduce `shell` for `openURL`, future `openPath`, and `revealInFileManager`; move recent documents/incoming-open events to an app/document API. Keep deprecated forwarding exports while examples migrate.
3. **Unify desktop interaction:** shared menu items/accelerators, semantic native roles, window handles, and root-owned window context. Keep existing ID-based functions as adapters where behavior matches.
4. **Decouple optional installations:** external WebView, SQLite, Runtimes/Nitro as explicit choices, preserving Go compatibility and production selection. Keep the SQLite path helper. A library can remain in Go while disappearing from the default app dependency graph.
5. **Add the small React layer:** first current-window, typed event, close-guard, and shortcut hooks; then improve `useNativeMenu`. Keep imperative APIs authoritative.

During migration, preserve distinct behavior such as conditional file writes and close guards. Do not introduce aliases that suggest semantic equivalence where none exists. Update the kitchen-sink app and guides to demonstrate the canonical APIs, leaving compatibility exports only where they serve existing consumers.

This work can begin in this repository without upstream Expo Desktop changes. Jamie's input would be especially useful on desktop module compatibility and extension conventions; it need not block the contract cleanup. Actual Windows feature implementations remain separate work, guided by these shared contracts.
