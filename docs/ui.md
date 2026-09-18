# Native UI

`@legendapp/frame-ui` defines only the three controls used by the [shared Settings starter](universal-settings.md): `Button`, `TextInput`, and `Select`. It owns their small contracts and selects replaceable implementations. Buttons are actual native controls, with no React Native `Pressable` implementation.

```tsx
import { Button, TextInput, Select } from '@legendapp/frame-ui';

<TextInput defaultValue="" onChangeText={setName} accessibilityLabel="Display name" />
<Select options={themes} value={theme} onValueChange={setTheme} accessibilityLabel="Appearance" />
<Button onPress={save} disabled={saving}>Save changes</Button>
```

| Platform | Button | TextInput | Select |
| --- | --- | --- | --- |
| macOS | AppKit `NSButton` | AppKit `NSTextField` | AppKit `NSPopUpButton` |
| iOS | Expo UI SwiftUI Button | Expo UI SwiftUI TextField | Expo UI SwiftUI Picker, menu |
| Android | Expo UI Compose Button | Expo UI Compose TextInput | Expo UI Compose Picker, segmented |
| Web | HTML button | HTML input | HTML select |
| Windows | WinUI Button | WinUI TextBox | WinUI ComboBox |

The macOS controls are Fabric components in a standalone pod. Mobile applications install optional peer `@expo/ui@0.2.0-beta.9`, the pinned implementation for Expo 54. Desktop/web implementations do not import it. Compose requires a development build; the universal starter includes `expo-dev-client`. See the [Expo 54 UI documentation](https://docs.expo.dev/versions/v54.0.0/sdk/ui/) and [Compose setup](https://docs.expo.dev/versions/v54.0.0/sdk/ui/jetpack-compose/).

## Contracts

All controls accept `style` for React Native layout and `testID`. Layout styles allocate the frame; they do not promise arbitrary styling of OS-rendered chrome. The iOS adapters own their SwiftUI Host boundaries so controls can sit beside ordinary React Native content. Android/web use React Native layout wrappers. Native appearance and selection presentation can differ by platform.

**Button** accepts string `children`, optional argument-free `onPress`, `disabled` (default false), and `variant` (`default`, `bordered`, `borderless`). Disabled controls do not invoke the action. Defaults are 160 points wide and 36 high on desktop/web, 44 high on iOS, and 48 high on Android. Set a wider frame for longer labels. Icons and arbitrary React children are deferred.

**TextInput** accepts `defaultValue`, optional `onChangeText`, and `accessibilityLabel`. It is deliberately uncontrolled: `defaultValue` initializes the native editor, and changing it after mounting does not replace an edit. Use `onChangeText` to keep application state; remount with a new key to reset the field. Expo UI 54 does not provide a fully controlled text field contract, so this API does not pretend to support `value`. Secure entry, validation, multiline input, and imperative focus/reset are deferred.

**Select** accepts a nonempty `options` array of `{ label, value }`, a controlled string `value`, `onValueChange`, and `accessibilityLabel`. Values must be unique and the selection must match an option. Reordering options preserves semantic selection. Labels may repeat. Adapters translate values to indices where required by the upstream API. A native menu on iOS/macOS and a segmented picker on Android are appropriate for this small preference choice; large/searchable selections are not yet part of the contract.

Native bridge types, Expo modifier arrays, and backend-specific props are private implementation details. A future upstream implementation can replace a backend when it satisfies these contracts and their behavior checks without changing application imports. This package does not require a framework layout or routing system.

## Windows appearance

On Windows, this package supplies the standard React Native `Appearance` native
module with a working `setColorScheme` implementation. Use
`Appearance.setColorScheme("dark")`, `"light"`, or `null` to return to System;
Uniwind's theme selection uses the same path. Each mounted WinUI control receives
native theme notifications, and newly mounted controls read the current preference.
Theme changes do not recreate editors or add theme/state props to the public controls.
OS changes apply while System is selected. Native acceptance is still pending;
see [Windows issues](windows-issues.md#foundation-work--2026-09-15).

## Optional Uniwind bindings

Import the same three controls from `@legendapp/frame-ui/uniwind` to add `className` through upstream `withUniwind` on native platforms and `useResolveClassNames` on web. Classes map to the existing layout `style`, with explicit styles taking precedence. The base entry has no Uniwind dependency at runtime. See [styling setup, themes, and limitations](styling.md).

## Integration and verification

The kitchen sink's **Native UI** card exercises activation, disabled state, dynamic labels, remounting, text editing, and semantic selection. The Settings starter demonstrates the same imports across targets.

```sh
bun run test:ui
bun run test:universal
bun run typecheck
bun test tests
```

`test:ui` builds a packed kitchen-sink consumer with the test-only driver. It checks a mounted NSButton hit target, dispatches AppKit actions, and verifies React updates. Text/selection checks invoke the native delegate/action paths, including changed defaults and reordered options with duplicate labels. This is in-app native verification; it does not replace real pointer/keyboard and accessibility testing.

`test:universal` generates real mobile/Windows projects and bundles the shared Settings entry for all five targets. It verifies that shared files and existing generated projects survive target switching and that platform bundles select the expected UI backend. Reports live under the consumer's `.frame` directory.

Native Android and Windows execution remain pending. Windows uses WinUI controls hosted through RNW ContentIsland, with labeled, disabled placeholders if the UI module is absent or native initialization fails. Placeholders preserve layout/test IDs, do not attach action handlers, and do not load unavailable native bindings. Remaining implementations are tracked in [known Windows issues](windows-issues.md). Router, declarative windows, and a larger UI catalog remain deferred.

## Recorded validation — 2026-09-13

- Workspace and generated Settings TypeScript checks passed; 127 unit/codegen tests passed with 533 assertions.
- The packed macOS Settings app built, and the packed kitchen sink passed all six native UI checks.
- The shared Settings app built and ran on the iPhone 17 simulator (iOS 26.5). Interactive typing, single-line Return behavior, menu selection, copying preferences, and SecureStore write/read/delete passed. Safe-area layout and the visible empty input were checked after a restart.
- Web typing, selection, copying, and unavailable secure storage behavior passed through the browser UI.
- All five shared-screen bundles passed. Real iOS/Android/Windows generation preserved shared files and earlier native projects. A separate check also preserved the already-built macOS project and build record while generating Android/Windows.

Bun execution used the synchronized `/tmp/frame-api-clean` checkout because Bun stalled in Documents on this host. Native Android/Windows execution and macOS pointer/keyboard inspection remain unverified; native Mac UI automation was blocked by the locked desktop. These checks do not establish mobile production distribution or Windows UI support.

The new Windows implementations are source-complete for the three contracts but await native compilation and UI acceptance. Run `bun run test:windows:features` on an interactive Windows machine. These are WinUI controls, not Pressable wrappers.
