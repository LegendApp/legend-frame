# Universal application API plan

Date: 2026-09-13

Status: the narrower [shared Settings starter](universal-settings.md) and three-control [UI foundation](ui.md) are now implemented. Router, declarative windows, and the broader phases below remain deferred. The original proposal was deferred in favor of the smaller [clipboard, secure-storage, and linking migration](expo-api-adapters.md). Retained for future review. This document plans implementation; creating it does not start the implementation, upgrade dependencies, or authorize publishing. It supersedes the desktop-first direction of the [API structure review](api-structure-review.md), while retaining that document's source inventory and useful implementation findings.

The subsequent [API ownership decision](external-libraries.md#public-contracts-and-replaceable-implementations) establishes curated framework contracts with replaceable implementations, rather than a blanket reexport layer. The three small adapters are implemented. Package names and the phases below remain proposals, not an instruction to resume the larger work automatically.

## Goal and starting recommendation

Build one application codebase for web, iOS, Android, macOS, and Windows. Align shared contracts with Expo, use existing libraries on supported platforms, and provide desktop implementations where support is missing. Application code should keep working as those implementations move upstream.

Start with a compatibility and native-window context probe, then deliver one shared Settings flow. Do not begin by renaming every desktop export or building a complete component library. The first slice must exercise routing, rendering, a framework API, and the existing development workflow together.

The core product decisions are already agreed:

- Expo Router owns route discovery, links, parameters, and navigation integration.
- A declarative `Windows` navigator expresses presentation policy across platforms.
- `/ui` provides Expo-aligned controls and framework presentation components.
- Framework APIs can delegate to Expo/community implementations on mobile/web and frame implementations on desktop.
- Implementation quality and dependency cost still matter. Alignment does not require using an unsuitable backend or wrapping every external package.

## What exists and what must change

| Existing foundation | Consequence for this plan |
| --- | --- |
| [Starter](../packages/cli/templates/blank-typescript/package.json) pins Expo 54 and React Native 0.81 | Modern Expo UI and Router examples cannot simply be copied into this dependency matrix. Select and prove a compatible baseline first. |
| [Platform selection](../packages/cli/src/platform.ts) requires one desktop target per project | Separate the application's supported platforms from the target of a particular command/build. One source project must survive switching targets. |
| [Starter creation](../packages/cli/src/create.ts) removes or replaces files/dependencies for Windows | Replace destructive target specialization for the universal starter with platform resolution and target-specific generated configuration. Preserve existing desktop starters during migration. |
| [Entry point](../packages/cli/templates/blank-typescript/index.ts) registers `App` and handles worker startup | Introduce Router entry integration without losing desktop host initialization or accidentally starting the application router inside background workers. |
| [macOS windows](../packages/desktop-windows/macos/RNDesktopWindows.mm) mount separate React roots | Shared JavaScript does not automatically preserve React providers or navigation context. This is an architecture gate. |
| Current desktop SDK and [Windows host](windows-slice.md) are integrated | Reuse their native and workflow foundations. Do not build a second desktop launcher or a separate Windows application architecture. |

Expo's documented custom navigator integration is currently alpha and available in SDK 56 and later. Its library entry point is `unstable_integrateWithRouter`; access to raw router state/dispatch is explicitly less stable. Keep version-specific integration inside one adapter. These extension points do not establish multi-window support by themselves. [Expo Router custom navigators](https://docs.expo.dev/router/advanced/custom-navigators/)

Expo UI's SDK 56 universal layer provides shared components over SwiftUI and Compose, with experimental web support. Public documentation reviewed here does not establish ready-to-use macOS or Windows support for our host. Jamie's information should inform the selected implementation and version. [Expo UI announcement](https://expo.dev/blog/expo-ui-stable-sdk-56)

## Proposed package boundaries

Names below are working names for review, not a package rename commitment.

| Public boundary | Ownership |
| --- | --- |
| `@legendapp/frame-api/<feature>` | Expo-aligned shared capability contracts and platform-selected adapters |
| `@legendapp/frame-ui` | Shared controls backed by Expo UI where suitable, with desktop adapters and explicit extensions |
| `@legendapp/frame-ui/router` | Expo Router integration exporting `Windows`; plain control imports must not import Router |
| Existing native feature packages | Internal desktop implementations reused behind the new contracts |
| Existing `@legendapp/frame/*` | Compatibility entry points while internal consumers migrate |
| Original external package imports | Library-specific APIs such as database operations and background runtimes, unless a real universal contract justifies an adapter |

A universal import must resolve without evaluating another platform's native module. Use platform files/exports and verify actual Metro, TypeScript, web bundler, and native autolinking behavior. Avoid an eager barrel that loads every optional native feature. Keep capabilities granular: platform support, native-module presence, and permission state are different questions.

Favor exact Expo names, signatures, and result behavior for the supported shared subset. Document every difference. Desktop extensions should be explicit and should not force unrelated mobile dependencies. Do not flatten rich desktop behavior into a lowest-common-denominator interface.

## Phase 0 — Select the baseline and resolve the rendering risk

**Deliverable:** a small reproducible in-repo probe plus a compatibility decision record. This is the first implementation batch after review.

1. Record exact compatible versions of Expo, Router, Expo UI, React, RN, RN macOS, RN Windows, Expo Desktop, and native templates. Check the current pins against a newer coherent matrix; do not upgrade the entire workspace speculatively.
2. Exercise the intended Router extension with two file-based routes on a mobile/web fixture and a macOS host. If the desktop-compatible baseline needs an older extension mechanism, document that adapter or the specific upstream change required. Do not assume the new API can be backported independently of its dependencies.
3. Prove that a secondary native window can render a route with correct parameters, navigation ownership, and a provider value that updates from the main window.
4. Investigate a native portal/container approach that preserves the logical React tree. Verify it against the actual renderer; do not rely on an unproven cross-surface portal assumption.
5. If separate roots are necessary, prototype explicit per-window navigation and shared-service context. State the limitation: arbitrary React providers cannot be automatically copied across roots. Return that tradeoff for review if it materially changes the agreed developer experience.
6. Mount one Expo UI-backed control on the chosen mobile baseline and inspect the actual macOS support branch/package with Jamie. A missing desktop control may use a narrowly scoped adapter while the router/host work proceeds.

**Exit criteria:** named version pins and dependency consequences; working provider-update and route-parameter evidence in a second macOS window; chosen Router integration and rendering approach; an explicit Windows compatibility assessment. Record unsupported targets as unresolved rather than treating a generated bundle as native acceptance.

**Jamie input:** compatible desktop release matrix, macOS Expo UI implementation status, and supported renderer/window attachment mechanisms. These are concrete questions to share; no messages are sent by this plan. Local probes and API drafting can proceed without waiting, but a missing essential upstream primitive must be surfaced before proceeding with dependent implementation.

## Phase 1 — Create the universal project and adapter foundation

**Deliverable:** one integrated sample project that uses the shared source tree on web/mobile/desktop.

- Add a universal starter/sample mode with one `app/` route tree, shared app identity and shared dependency declarations. Start with the platform set proven in Phase 0; record Windows gaps explicitly.
- Separate supported platforms from the selected run target. Keep generated native projects, compatibility signatures, build metadata, and runtime selection target-specific so one target cannot overwrite another's artifacts or claim another's compatibility.
- Use standard Expo workflows for mobile/web and the existing frame orchestration for desktop. Compose configuration rather than replacing mobile/web Expo configuration with a desktop-only generated transport config.
- Integrate Router startup with the current desktop runtime initialization. Maintain prebuilt/custom selection and keep worker entry behavior separate.
- Introduce the public package boundaries and safe platform resolution with one capability adapter: clipboard text. Delegate mobile/web behavior to the selected Expo Clipboard version; reuse current desktop clipboard code behind the equivalent contract.
- Establish typed unsupported/missing-module failures and resource cleanup internally. Preserve documented Expo result and error behavior where promised; do not silently report a failed operation as success or cancellation.

Clipboard is small enough to expose real platform differences without distracting from the slice. Match the chosen version's `getStringAsync`/`setStringAsync` behavior, and preserve browser access restrictions rather than simulating success. Rich clipboard formats remain explicit desktop extensions until separately mapped. [Expo Clipboard reference](https://docs.expo.dev/versions/latest/sdk/clipboard/)

**Exit criteria:** the same installed sample and route files launch on web, iOS, Android, and macOS through documented commands; platform imports do not require unavailable native modules; switching targets preserves shared configuration/source. Windows generation and native progress are reported separately. Validate a packed consumer as well as the workspace sample.

## Phase 2 — Deliver the Settings slice

**Deliverable:** one Settings route presented appropriately on each available target.

Proposed layout shape:

```tsx
import { Windows } from '@legendapp/frame-ui/router';

export default function Layout() {
  return (
    <Windows>
      <Windows.Screen name="index" />
      <Windows.Screen
        name="settings"
        options={{
          presentation: { desktop: 'window', mobile: 'modal', web: 'route' },
          window: { title: 'Settings', width: 640, height: 480 },
        }}
      />
    </Windows>
  );
}
```

Expo Router discovers `settings.tsx`. A normal `<Link href="/settings">` invokes the declared policy. Route declarations configure possible destinations; merely declaring a screen does not open its window.

Build only the controls the screen needs: a label, text input, switch, and button, with layout supplied by suitable Expo UI or React Native primitives. Prefer upstream universal props and events. Keep ordinary React Native content composable; do not require all application layout, lists, or custom rendering to pass through our wrappers.

The screen edits one shared preference and copies a diagnostic string through the new clipboard API. Use an application-owned in-memory store/provider for the initial shared-state proof. Persistent settings and cross-runtime synchronization are separate contracts, not implicit promises of this slice.

| Behavior | Acceptance |
| --- | --- |
| Open Settings twice | Focus the existing singleton desktop window; avoid duplicate mobile presentations/history entries according to the documented policy |
| Edit shared preference | Main and Settings views observe the same value; closing/reopening preserves application-owned state |
| Native close | Remove the specific window instance; allow a close guard to reject the request |
| Mobile/browser Back | Dismiss/navigate according to the platform's history; no desktop-style popup on web |
| Direct `/settings` entry | Resolve correctly, including browser refresh; define which main desktop window is created on a cold launch |
| Focus and accessibility | Text editing, keyboard traversal, labels, and focus restoration work in the selected native controls |
| React lifecycle | Re-render, development remount, and reload do not duplicate windows or listeners |
| Native open failure | Expose failure and reconcile state without a phantom route/window |

On desktop, distinguish route definition, route instance, native window ID, and focused window. The instance key owns lifecycle; OS focus must not determine the owning window of a component. Do not implement native close as an unqualified global `back()`.

**Exit criteria:** the flow works on web, iOS, Android, and macOS with the same screen source and documented platform options. The native context proof remains valid with real controls and application state. Acceptance evidence is behavior-specific, not just compile success.

## Phase 3 — Prove independent windows and complete the Windows slice

**Deliverable:** the abstraction handles real multi-window behavior, including Windows native execution.

- Add `documents/[id]` with two simultaneous document instances, each with its own nested navigation and draft state.
- Define identity rules explicitly: Settings is singleton; document identity can select an existing document window. Multiple views of the same document require an explicit instance policy.
- Close an unfocused document without navigating or closing another. Confirm targeted guards and independent nested Back behavior.
- Define context-bound navigation from a window and explicit targeting for commands outside React. Do not use mutable global focus as the implicit target of delayed asynchronous navigation.
- Implement the Windows window/container and required control/clipboard backends using the shared contracts and existing Windows host/workflow. Port the slice only; keep unsupported SDK features explicit.
- Run the same scenario on a Windows machine, including native close, keyboard focus, DPI-aware sizing, and repeat launch/reload. Earlier configuration and bundle checks remain useful but are not sufficient.

Windows work can begin once Phase 0 fixes the host contract; this phase is its completion gate, not a reason to defer all Windows implementation until the end. The universal milestone is complete only when the agreed slice runs on all five targets. Native tests unavailable locally must remain visibly pending for the Windows machine.

## Phase 4 — Expand APIs through real consumers

**Deliverable:** an updated capability matrix and incremental migrations, guided by the working shared app.

| Order | Capability | Approach |
| --- | --- | --- |
| 1 | Persistent preferences and secure storage | Select mobile/web implementations deliberately; preserve desktop project scoping. Define hydration, subscriptions, missing values, and web security differences. Do not claim browser storage is equivalent to an OS credential store. |
| 2 | File selection, filesystem, and links | Align to the selected Expo contracts where semantics fit. Model selected files/URIs and desktop paths honestly; browser file access cannot promise arbitrary absolute paths. Preserve conditional writes and other existing desktop behavior. |
| 3 | Menus, toolbars, dialogs, shortcuts | Add declarative ownership where useful; share menu/action types across desktop surfaces and provide intentional mobile/web presentation. Global shortcuts/tray need not have fake mobile substitutes. |
| 4 | Notifications and remaining controls | Reuse platform libraries under explicit shared contracts; add controls demanded by sample/application migrations, not a speculative catalog. |
| 5 | Remaining integrations | Keep database operations, workers, camera, and WebView APIs upstream-owned where that serves developers; provide universal conveniences only for real cross-platform behavior. |

For each migration, record the chosen upstream version/API, supported subset, desktop extensions, dependency cost, and what permits replacing our implementation later. Verify behavior at the contract boundary so upstream swaps can reuse the same acceptance cases.

Migrate examples before deprecating old exports. Retain narrow compatibility adapters where semantics match. Revisit prebuilt inclusion, app installation dependencies, and production selection independently; a shared facade does not require every backend to be installed or linked on every platform.

## Review decisions and scope

| Decision | Recommendation |
| --- | --- |
| First implementation batch | Phase 0 compatibility/context probe, followed by the integrated Settings slice |
| Public imports | Separate capability and UI packages; Router integration beneath `/ui/router`; final names can wait until Phase 1 |
| Provider behavior | Prefer preserved logical context; review any separate-root limitation before promising transparent composition |
| API alignment | Expo contracts by default for shared behavior, with explicit desktop extensions and documented web limits |
| Platform completion | Early macOS/mobile/web progress; Windows is required to complete the universal slice |
| Migration strategy | Additive implementation and example migration before removing current APIs |

Out of scope for these first phases: converting every module, implementing an entire design system, replacing upstream database/worker APIs, production Windows packaging, public distribution, automatic updates, session restoration, multi-process isolation, and a general Node compatibility runtime.

After review, the first useful result should be the Phase 0 decision record and working context probe. If those succeed, continue through the agreed phases without a permission request for every routine edit. If they expose a fundamental incompatibility or require a different application model, present the evidence and a concrete revised choice before committing the architecture to it.
