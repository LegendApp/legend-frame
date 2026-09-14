# Audio player

```ts
import { createAudioPlayer } from '@legend-apps/audio';

const player = await createAudioPlayer({ uri, title: 'My track' });
await player.play();
await player.seekTo(10); // seconds
const status = await player.getStatus();
await player.pause();
await player.remove(); // release the player when its owner is finished
```

The contract uses Expo-style source, player, and position names, with asynchronous
commands consistently across backends. It is a deliberately small framework
contract, not a re-export of every Expo Audio option. Status includes `playing`,
`currentTime`, `duration`, `didJustFinish`, and `error`. Native creation waits for
media readiness with a 15-second timeout. Web metadata may load after creation;
seeking waits for metadata with the same timeout. Inspect status for later failures.

Use Expo Audio 1.1.1 and its background-playback plugin in a mobile consumer. The
native desktop implementations require a rebuilt client. The maintained Go profile
includes audio; custom projects include it by adding the package. Windows source
is present but native acceptance remains open.

The Music template configures these dependencies automatically. When adding audio
manually to a universal project, exclude `@legend-apps/audio` from native autolinking
on iOS/Android and exclude `expo-audio` on macOS/Windows using `expoByPlatform`.
These exclusions affect native linking and codegen; Metro still selects the
framework's mobile JavaScript adapter. Keep the Expo Audio plugin on mobile only.

The Music Lite example shows polling with cleanup, queue ownership, resource
release, persistent position, file import, and media controls. The active player
owns system media controls; applications should arbitrate playback themselves
before creating multiple players. Each platform decides which codecs it supports.
HTTP sources follow platform transport policy. Browser playback may require a user
gesture. Android sustained background playback requires the Expo configuration and
lock-screen controls used by the example.

Replacement implementations must preserve seconds, explicit resource disposal,
command failures, and status semantics. No player, queue, or audio module is loaded
by the framework root. Use direct external-library imports for capabilities outside
this contract, such as recording or sample analysis.
