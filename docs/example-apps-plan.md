# Small application examples

Scope approved 2026-09-13: standalone Notes Lite, Music Lite, and Diff Lite,
available through the installed CLI and using public APIs only. Keep Expo 54 and
Expo Desktop beta pinned. No sibling checkout dependencies.

## Delivery

- Notes Lite: searchable local notes, adaptive list/detail, autosave, recovery,
  import/export, keyboard and close behavior, shared document windows.
- Music Lite: import audio, persistent queue and position, play/pause/seek,
  native desktop playback and Expo mobile playback, media controls.
- Diff Lite: select two text files, readable line comparison, optional desktop
  Git comparison through the public process API.
- Foundations: durable app-owned records, explicit selected-file semantics,
  lifecycle/open/focus/close integration, Windows implementations and tracked
  acceptance, accessible resizing and keyboard interaction.
- Extension guide: platform adapters, native library inclusion, Go versus custom
  builds, and replacing a framework implementation without changing callers.

## Acceptance

Create each example from SDK archives outside the checkout. Check consumer types
and bundles for web, iOS, Android, macOS, and Windows. Run model failure/recovery
tests, browser interaction checks and available native builds. Record Windows
source/generation checks separately from native compilation and runtime checks;
this macOS environment cannot substitute for a Windows machine.

Examples deliberately omit sync services, transcription, a rich Markdown editor,
full music-library scanning, and Git conflict resolution. Application-specific
models belong in example source, with replaceable persistence/media boundaries.
