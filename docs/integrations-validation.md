# Desktop integrations validation — 2026-09-11

Notifications, tray/menu-bar support, and Sparkle updates are implemented in
`spark`, with kitchen sink controls and separate native packages.

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| Unit/API/codegen/packaging tests | 89 passed; 341 assertions |
| Notifications in Go and custom Debug | Permission reads, scoped lists, response subscription/disposal, cancellation, and current-permission posting behavior passed without prompting |
| Tray in Go and custom Debug | Create, duplicate conflict, update, remove and recreate passed |
| Updater in Go and custom Debug | Status works; start/check correctly reject without starting Sparkle |
| Standalone Release | Sparkle embedded and loaded without Metro; updater starts idempotently and leaves automatic checks disabled |
| Menu-bar-only Release | CNG sets accessory activation; main native window is hidden while React mounts |
| Configuration removal | Real prebuild removes the old feed/key and resets menu-bar-only activation |
| Signed release feed | Real Sparkle tools sign/verify archives and feeds for two successive fixture releases; retries preserve signatures; reused build numbers reject different bytes |
| Packaging retry | Simulated Apple pipeline passes the same verified ZIP into feed signing after a recoverable signing failure, without recreating it or resubmitting |
| Pruning | Reduced Debug contains neither the three new modules nor Sparkle.framework; retained APIs run |
| Saved Go artifact | Refreshed and strict deep signature verification passed |

No private update key was added to Keychain during testing. Signing fixtures use
ephemeral keys that are deleted afterward. Downloaded Sparkle tools and its native
pod archive are pinned to 2.9.6 with a SHA-256 checksum. No artifacts were published
or submitted for notarization.

The Mac remains locked, so visible notification banners/responses, menu-bar clicks,
and the full Sparkle download/install/relaunch UI have not been accepted. The
existing full-SDK Save acceptance test also remains blocked. Passing native API,
Release startup and signed-feed tests does not prove a production update installs.

Commands and API examples are in [desktop integrations](desktop-integrations.md).
Generated evidence is in `docs/evidence/integrations-2026-09-11/` (ignored). Tests
ran from `/tmp/spark-sdk-validation` because Bun file access stalls in this Mac's
Documents checkout. Source, the lockfile, package archives and Go were synced back.
