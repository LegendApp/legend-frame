# Example acceptance record

Checked on 2026-09-13 with the pinned Expo 54 / React Native 0.81 / Expo Desktop
beta matrix. These checks cover the small application examples, not production
packaging or complete platform parity.

## Automated checks

- Workspace typecheck and model/API/CLI tests pass. Persistence tests cover a
  corrupt snapshot, unreadable storage, unknown schema, edits during a pending
  save, retry, deleted-note restoration, and asynchronous resource teardown.
- `bun run pack:local` followed by `bun scripts/test-examples.ts /tmp/LegendExamplesFinal` creates three independently
  installed consumers from SDK archives outside the checkout. All three consumer
  typechecks and all 15 platform bundles pass. Mobile/web bundles are checked for
  accidental desktop native bindings. Platform switching preserves configuration.
- Windows prebuild succeeds through Expo Desktop beta and includes the shared
  host's application integration. This is generation evidence, not a native build.
- The macOS Go client builds with audio and AsyncStorage included.

## Runtime checks

- Notes on web: create, edit, save, reload, delete, and restore through the UI.
- Notes on iOS: native development build, native New note button, editing, and
  retained text after a Metro reload. This found and fixed a real codegen issue:
  Expo exclusions must also reach React Native's generated native registry.
- Notes on macOS, including the rebuilt Go client: Hermes startup, native storage readback, a secondary React
  window sharing the notebook, editing, and guarded close.
- Music on web: import a generated local WAV through the application's file-input
  handler, retain the Blob in IndexedDB, seek, pause, reload, and resume at the
  stored ten-second position without autoplay on reload.
- Diff on web: initial addition markers, swapped removal markers, and importing
  a text-file fixture through the application's file-input handler.
- Music on macOS: native build, Hermes startup, playback clock, seek to ten
  seconds, pause, queue/position readback, and player disposal.

## Audio environment qualification

The machine's default output was the Jump Desktop virtual audio device. The
unmodified macOS app timed out loading audio; browser playback loaded metadata
but its clock stalled. A standalone AVFoundation probe reproduced the stall.
Selecting the built-in system speakers for that probe's player advanced normally.

The successful native Music playback check used the same per-player output
selection in a temporary installed consumer, without changing system output or
framework source. That test-only change was then removed. The shipped adapter and
Go client use the user's normal output. Audible playback and transport controls
still need a normal-device interaction check; the silent WAV proves timing and
commands, not audible quality. The browser's stalled-clock path remains unaccepted.

## Still requires target machines

Windows native compilation and behavior remain open in [Windows issues](windows-issues.md),
especially secondary windows, guards, activation forwarding, WinUI controls,
AsyncStorage's unpackaged path, and audio transport controls. Android and mobile
Music background/lock-screen behavior have bundle coverage, not runtime acceptance
in this session. OS file-association registration on Windows is now implemented in source; native acceptance remains pending. See [Windows acceptance](windows-issues.md).

No cloud services or sibling Legend application repositories are required.

## Notes desktop behavior follow-up (2026-09-17)

Notes Lite now includes shared commands, Settings/theme persistence, and window
session restoration. A new packed consumer typechecked and bundled on all five
platforms, and its macOS development binary built and passed the native checks
recorded in [Notes acceptance](notes-lite-acceptance.md). The focused model/session
suite has 15 passing tests; the workspace suite has 234 passing tests. Windows
OS behavior and physical display removal remain target-machine acceptance work.
