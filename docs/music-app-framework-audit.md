# Legend Music framework fit audit

Source audit, 2026-09-16. Inspected `../legend-apps/apps/music` and its native
packages against this framework's working tree, including the new sidecar work.
Legend Apps HEAD: `6c311300`; framework base HEAD: `089f740` with working changes.
No app migration or native runtime acceptance was performed for this audit.

## Conclusion

The framework can be the host for Music, but its supplied APIs are not sufficient
for complete feature parity today. A macOS migration can reuse Music's existing
native media packages in a custom build, subject to integration testing. That is
quite different from implementing everything in framework core. Full Windows
parity also needs new backends for Apple-specific packages and validation of the
framework's Windows runtime.

Music itself is currently macOS-first. Its manifest lists macOS, iOS and Android,
not Windows or web; the native module list is populated only for macOS. The
manifest alone is not evidence of mobile feature parity. Provider settings and
implementations for Spotify and Apple Music are present in source, even though
the README emphasizes the local-library workflow. Their runtime success is not
established by this source audit.

## Capability comparison

| Area | Music actually uses | Framework today | Work and ownership |
| --- | --- | --- | --- |
| Playback | Load, play/pause/stop, seek, volume; completion/progress/error events; next/previous remote commands; title/artist/album/artwork and playback state | `@legendapp/spark-audio` exposes create/play/pause/seek/status/remove. macOS has native play/pause remote handlers and basic Now Playing; Windows enables basic transport controls. No public volume, full metadata, or remote next/previous event contract | Extend the replaceable audio/media-session adapter. Queue/shuffle/repeat remain app logic. Polling can implement some progress/completion behavior, but does not supply the missing controls |
| Library indexing | Batched recursive scans, extension filtering, incremental skips/progress, metadata extraction and artwork cache, library change observation | General file I/O/listing exists. `watch` explicitly provides nonrecursive invalidation. No media tags or scanner package | Recursive watcher/traversal belongs in reusable file infrastructure. Media parsing/scanning orchestration/artwork belong in a separate optional media library; reuse the existing packages first on macOS |
| Song overlay | Transparent borderless nonactivating panel, status window level, no shadow, animated native spark changes | Normal multiple windows, spark changes, always-on-top and several macOS appearance options exist. No nonactivating panel/status-level/spark-animation API. Windows rejects transparency/titlebar/material/shadow options | Add portable overlay/focus semantics to windows, with explicit platform capabilities. Always-on-top alone does not reproduce the overlay |
| Drag/drop | File drops and native structured track payloads; continuous drag-hover positions for insertion indicators and reorder | Files/text/URLs, enter/leave/drop/end; no continuous hover event or typed custom payload surface | Add generic drag-over positions and custom data formats/operation semantics. Keep track objects and queue behavior in Music. Text encoding can carry IDs but does not replace hover support |
| Shortcuts | Global actions, scoped focus-aware routing, key-down/key-up, hold/modifier state, recording configurable hotkeys | Global shortcut registration and focused-window accelerator registration exist | Reuse accelerators for ordinary commands. Adapt the router; add missing key-up/capture semantics only where required. Do not import macOS virtual-key codes as a portable API |
| Spotify authentication | Browser login, PKCE, loopback callback server, secure random verifier/state, token persistence | Open browser/links and async secure storage exist. No loopback receiver or public cryptographic random API found | Add/reuse a narrow desktop authentication and crypto adapter. Music's synchronous credential initialization needs adaptation. A custom scheme is not a drop-in replacement for its existing redirect flow |
| Spotify playback | Hidden WebView running Spotify Web Playback SDK with token messages, media autoplay and real audio | Framework re-exports react-native-webview; Windows adapter remains unverified | Real account/device playback acceptance is required on both platforms. HTML/JavaScript/message smoke tests are not proof of protected streaming playback |
| Apple Music | Nitro Swift MusicKit authorization, catalog/library requests and native player | No corresponding framework adapter. Existing Music package is Apple-specific | Keep this as an optional provider library. Reuse its macOS implementation; Windows needs a different supported provider backend, not just a wrapper around the Swift module |
| Native UI fidelity | AppKit split views/sidebar, native search input, SF Symbols, glass effects, window controls and settings window composition | Small UI foundation and window-level materials; no equivalent complete set | Put these in the proposed desktop component library. Most are optional for equivalent functionality, but required for exact native visual/interaction parity. Preserve host integration where needed |
| Persistence/playlists | spark State observable files, synchronous storage reads, cached artwork, M3U files, quit-time flush | Async files/settings, SQLite, secure storage, lifecycle guards | Generally migration work, not a missing storage engine. Adapt persistence and startup sequencing; preserve existing paths/identity or migrate user data deliberately |
| AI playlist extension | Availability/discovery and prompt execution through installed Codex/Claude tooling, JSON/protocol handling | Process spawn, text stdin, binary stdout/stderr, timeout and helper bundles | Framework provides the transport. Discovery, agent protocol and result parsing stay in an optional integration library. Existing Nitro wrapper still needs integration/Windows work; no reason to bundle Node into framework |
| Distribution | Sparkle and existing app identifiers | macOS signing/update pipeline exists; Windows release pipeline remains incomplete | Map configuration and preserve identity. Windows packaging/signing/updates are a release gap independent of Music |

## Concrete source anchors

Music source below is relative to `../legend-apps/`:

- `apps/music/app.manifest.ts`: actual target/module declarations, usage description and release identity.
- `apps/music/src/components/LocalAudioPlayer.tsx`: completion, remote-command, occlusion/progress and persistence behavior.
- `packages/audio-player/src/index.ts`: volume, full Now Playing payload and event contract.
- `apps/music/src/systems/LocalMusicState.ts`: scan batches, progress, tag/artwork reads and watched library roots.
- `packages/media-library-scanner/src/index.ts`, `packages/file-scanner/src/index.ts`, `packages/media-tags/src/index.ts`: scan/metadata contracts.
- `apps/music/src/windows/index.ts`, `apps/music/src/overlay/CurrentSongOverlayWindowManager.tsx`: status-level nonactivating overlay and animated frames.
- `apps/music/src/components/Playlist.tsx`, `packages/drag-drop/src/index.ts`: track drag payloads and hover events.
- `packages/hotkeys/src/index.tsx`, `packages/keyboard-manager/src/index.ts`: scoped key routing and key-up/down dependency.
- `apps/music/src/providers/spotify/provider.ts`, `pkce.ts`, `SpotifyWebPlayerBridge.tsx`: loopback authentication, randomness and embedded player.
- `apps/music/src/providers/appleMusic/provider.ts`, `packages/apple-music/src/AppleMusic.nitro.ts`: provider interface and Swift Nitro dependency.
- `apps/music/src/providers/credentials.ts`, `apps/music/src/utils/fileSystem.macos.ts`, `packages/storage/src/index.ts`: synchronous persistence assumptions.

Framework evidence:

- [Audio contract](../packages/audio/src/types.ts), [macOS audio](../packages/audio/macos/RNSparkAudio.mm), [Windows audio](../packages/audio/windows/SparkAudio/SparkAudio.h).
- [Filesystem/watch contract](../packages/file-system/src/index.ts).
- [Window contract](../packages/window-options/index.d.ts), [Windows exclusions](../packages/desktop-windows/src/windows-options.ts).
- [Drag/drop contract](../packages/drag-drop/src/index.tsx), [shortcuts](../packages/desktop-shortcuts/src/api.ts).
- [Secure storage](../packages/secure-storage/src/desktop.ts), [processes](../packages/processes/src/index.ts), [sidecars](sidecars.md).
- [Third-party native discovery/selection](../packages/cli/src/project.ts): custom native dependencies are supported; using a library does not require incorporating it into the framework's public API.

## Integration constraints that are not new framework features

Several dependency names collide across repositories, including
`@legendapp/spark-drag-drop`, `native-menu`, `context-menu`, `file-dialog`, and
`secure-storage`. They have different versions and, in places, different APIs.
Migrate those callers or give retained legacy libraries distinct names; installing
both trees under the same names is not a clean compatibility strategy.

The spark Apps packages also use workspace/catalog dependencies, private package
metadata, and their own host/configuration conventions. A migration needs usable
package manifests, compatible native codegen/Nitro pins, and integration with the
framework host. Register native settings through Expo/Desktop configuration and
use a custom binary. The shared Spark Runner cannot acquire these native
modules from JavaScript.

Storage can be adapted, but changing bundle/project identity, file layout, or
Keychain service/account naming risks making existing libraries/playlists/tokens
appear lost. That is migration work to plan explicitly, not proof that the
framework lacks persistence.

## External-library and platform uncertainty

Spotify documents browser support and encrypted-media/autoplay requirements;
it does not establish this app's hidden embedded-player configuration as working.
Test actual playback, token refresh, background/minimized playback and command
roundtrips in the selected WebView on each OS. Source: [Spotify Web Playback SDK](https://developer.spotify.com/documentation/web-playback-sdk).

The [known Windows Nitro issue](windows-issues.md#confirmed-nitro-integration-blocker-2026-09-16)
affects a direct reuse path for Music's Nitro-based OAuth, secure storage, Apple
Music and Codex integrations. Fixing Nitro does not manufacture Windows
implementations for Apple-only libraries. Windows WebView and production release
acceptance remain separate prerequisites.

## Recommended implementation order

1. Complete audio controls and media-session semantics, with a tiny real playback test app rather than migrating Music first.
2. Add recursive filesystem watching and a batched traversal contract; keep metadata/artwork parsing in an optional media package.
3. Add nonactivating overlay behavior and resolve Windows transparency/titlebar support.
4. Add drag-hover/custom data and the keyboard event/capture pieces proven necessary by Music.
5. Establish OAuth loopback and secure random support; prove Spotify WebView playback separately before committing to that backend.
6. Package the existing native UI/media/provider libraries for external consumption, then do a macOS integration spike. Treat full Windows provider parity as additional library work and native acceptance, not an automatic result of the macOS migration.

No gap was inferred merely from a missing like-named export: generic capabilities
that can reproduce the behavior are counted as migration work, while native
semantics with no equivalent contract are recorded as gaps.
