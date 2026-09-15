# Small application examples

These are standalone applications created from the same universal Expo Desktop
beta template as Settings. Source ships inside the CLI; there are no dependencies
on `legend-apps`, `legend-notes`, or another checkout.

```sh
legend create MyNotes --example notes-lite
legend create MyMusic --example music-lite
legend create MyDiff --example diff-lite
```

Inside each project, run `bun run web`, `bun run ios`, `bun run android`,
`bun run macos`, or `bun run windows`. Mobile native development clients need a
first build. Desktop selects a compatible prebuilt runtime or requests a custom build
when a native dependency is missing. Rebuild an older prebuilt runtime for the new audio,
AsyncStorage, or Windows host implementations; JavaScript reload cannot add them.

## Notes Lite

Create and search plain-text notes, edit with ordinary React Native text inputs,
import/export text, and recover deleted notes. Large windows show a sidebar;
phones show a list and a detail screen. Desktop secondary windows share the same
notebook model and can show the same note. Autosave writes after 250 ms of idle
editing. Close/background handlers attempt to flush pending changes. A failed
save remains visible and can be retried; unreadable storage disables editing.

Notes are app-owned records, separate from imported files. Import copies text;
export writes a separate file. Edits do not overwrite the imported source.
Deleted notes remain recoverable until the application adds an explicit permanent
delete policy. This small example does not implement cloud sync, rich Markdown,
folder mirroring, or audio transcription.

## Music Lite

Import audio, choose a track, pause/resume, seek in ten-second increments, and
advance through the queue. Queue and position persist; restoring a session does
not automatically start playback. Mobile imports are copied into app documents;
web imports are retained as blobs in IndexedDB. Desktop imports retain original
file paths, so moving/removing the source produces an error on subsequent use.
Audio-format support comes from the platform decoder.

`@legend-apps/audio` provides the small player contract. It uses Expo Audio 1.1.1
on iOS/Android, AVPlayer on macOS, MediaPlayer on Windows, and HTML audio on web.
Mobile enables background playback through Expo's config plugin. Platform media
controls are connected to the active player. The example owns its queue and
persistence; the module owns player resources. This is not the full Legend Music
library scanner, metadata index, or visualizer.

## Diff Lite

Open two text files and view a line comparison with explicit addition/removal
markers and line numbers. Files are read-only. Each input is limited to 200,000
characters and comparison has a time limit to keep this small example usable.
The comparison algorithm comes from `diff`, imported directly.

On macOS, the Git action selects a repository and invokes `/usr/bin/git` through
the public process module, with an argument array, timeout, and external diff/text
conversion disabled. Other platforms retain ordinary file comparison. There is no
Git authentication, conflict resolution, or embedded shell.

## Persistence and replacement boundaries

`shared/records.ts` is an example-owned snapshot store, backed by upstream
AsyncStorage 2.2.0. Keys include the generated stable project identity, including
inside prebuilt. Windows supplies AsyncStorage's database-path override for our
unpackaged host. Two alternating checksummed records retain the previous completed
snapshot if a write is damaged. This checksum detects corruption, not tampering.

The store has one writer per key in a JS runtime. Desktop windows share that writer.
It is not a multi-process database or a sync engine. It does not encrypt data;
credentials belong in SecureStore. Browser storage remains subject to origin,
quota, and eviction rules. A write still in flight when the OS kills an app can
lose the newest changes; recovery uses the most recent valid completed snapshot.

Models validate a versioned data shape on load. Implement migrations in the decode
function before changing its version, retaining the previous snapshot until the
new write succeeds. Move a larger app to a database through the same persistence
boundary when it needs transactions, indexes, or concurrent writers.

See [extension development](extensions.md), [audio](audio.md), and
[known Windows issues](windows-issues.md). Native Windows compilation and interaction
checks must run on Windows; bundle success alone does not establish native support.
The [acceptance record](example-validation.md) distinguishes passing checks from
remaining device work, including the development machine's audio-output limitation.
