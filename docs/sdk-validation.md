# Initial SDK validation — 2026-09-11

For the later notifications/tray/updates work and current test count, see
[integration validation](integrations-validation.md).

Implemented in `frame`: the five agreed SDK groups, separate native
capability packages, CNG integration, and the kitchen sink example. macOS 14+,
Apple Silicon. No Node runtime in the app.

| Layer | Result |
| --- | --- |
| TypeScript | Passed |
| Bun unit/API/codegen suite | 73 tests, 275 assertions, all passed |
| Full SDK Go | Three native launches, 12 checks each; A/B/A file, settings and Keychain isolation/persistence passed |
| Custom native modules | Debug build compiled; generated URL/document associations and lifecycle settings verified in its Info.plist |
| Custom native behavior | Diagnostic run passed 19 of 20 checks; the successful Save case failed in its old in-process UI driver |
| Updated Save automation | Replaced the in-process driver with XCTest; the UI bundle compiles, but this Mac’s XCTest service cannot establish a control session |
| External accessibility acceptance | Save callback was exercised during diagnosis; final Save/accepted-quit acceptance and normal kitchen sink UI inspection remain pending because the Mac is locked |
| Native pruning | Seven unused SDK pods/classes absent from a production-graph Debug binary; app, clipboard and filesystem remain linked and execute successfully |
| Saved Go artifact | Refreshed `artifacts/runtimes/FramePrebuilt.app`; strict deep code-signature verification passed |

The custom diagnostic checks cover file watching across atomic replacement,
window React root mounting/unmounting, close cancellation, clipboard restoration,
Keychain CRUD, actual shortcut interception, native menu state/actions, real panel
cancellation, second-instance forwarding, popup cancellation, incoming URL/file
delivery and quit cancellation. This is not a claim that the entire final
unattended suite has passed.

## Reproduce

```sh
bun install
bun run typecheck
bun test tests
bun run test:native /tmp/DesktopSDKTests
```

`bun run test:all` runs the full sequence. Native tests require Xcode, CocoaPods,
the `xcodeproj` Ruby gem, an unlocked GUI session, and a working XCTest service.
See [SDK test documentation](sdk.md#tests) for the optional external UI driver.

Validation ran from a synchronized `/tmp/frame-sdk-validation` copy because Bun
file access stalls in this Mac’s Documents checkout. Native consumers were built
under `/tmp/FrameSDKKitchenSink`. Source and the lockfile are in the repository;
local package archives and Go were copied back. Logs and JSON reports are in
`docs/evidence/sdk-2026-09-11/` (ignored generated artifacts).

Still required before calling the final acceptance complete: run the XCTest
Save/accepted-quit case on a working unlocked session, inspect the normal kitchen
sink UI, and resolve any failures. The expanded SDK has not yet been retested on
the second Mac. No Release compile, Developer ID signing, notarization submission,
public publication, or hosted build was performed for this SDK expansion.
