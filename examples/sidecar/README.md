# App-supplied helper example

This is a tiny standalone C helper that echoes stdin byte-for-byte to stdout,
reports readiness on stderr, and exits when stdin closes. It requires no Node
runtime. It demonstrates transport, not a framework RPC protocol. Interactive
services should define their own framing and flush each response.

Build from this directory on macOS:

```sh
mkdir -p binaries/macos-arm64
cc echo.c -o binaries/macos-arm64/echo
```

On Windows, use a Visual Studio developer shell targeting the desired architecture:

```powershell
New-Item -ItemType Directory -Force binaries/windows-arm64
cl /O2 /MT echo.c /Fe:binaries/windows-arm64/echo.exe
```

Use `windows-x64` instead when targeting x64. Compile on each target; the framework
packages these artifacts, it does not cross-compile arbitrary helper projects.
Copy the source and binaries directory into your app's `helpers/echo` folder and
add this to `desktop.config.json` (include only targets you actually build):

```json
{
  "helpers": {
    "echo": {
      "macos-arm64": { "directory": "helpers/echo/binaries/macos-arm64", "executable": "echo" },
      "windows-arm64": { "directory": "helpers/echo/binaries/windows-arm64", "executable": "echo.exe" }
    }
  }
}
```

Use a development build of your app; the shared prebuilt runtime cannot include
an app-specific helper. Then call the existing process API:

```ts
import { spawn } from '@legend-apps/desktop/processes';

const child = await spawn({ executable: 'helper:echo', timeoutMs: 5000 });
await child.write('hello from React Native\n');
await child.closeInput();
const result = await child.exited;
console.log(result.stdout); // hello from React Native
```

Test failure with `args: ['--fail']` and check `exitCode === 7` and `stderr`.
For large/binary output, use the optional `spawn` output callback; chunks are
base64 bytes, not independently decodable UTF-8 messages.

## Complete request/response example

`worker.c`, `client.ts`, `service.ts`, and `App.tsx` form a small desktop application
example. The worker echoes binary payloads or computes FNV-1a checksums (not a
cryptographic hash). It can deliberately crash or hang to demonstrate recovery.
The React UI displays results and has Start, Echo, Checksum, Crash, Timeout,
Restart, and Stop buttons, using framework-native buttons.

From the framework checkout, prepare an independent app automatically:

```sh
bun run pack:local
bun scripts/prepare-sidecar.ts /absolute/path/to/HelperDemo
cd /absolute/path/to/HelperDemo
bun run macos # or windows; choose Build for the custom helper runtime
```

The preparer requires a fresh destination, compiles the helper for the host target,
and typechecks the generated app. On Windows run it from a Visual Studio developer
shell matching `LEGEND_WINDOWS_ARCH` (or the host architecture).

Alternatively, create an ordinary desktop app and copy the three TypeScript files into its root:

```sh
legend create HelperDemo
cd HelperDemo
bun add @legend-apps/ui@0.1.0-prototype.0 base64-js@1.5.1
# Copy App.tsx, client.ts, service.ts from this example into this directory.
# Copy worker.c into helpers/worker/worker.c.
mkdir -p helpers/worker/binaries/macos-arm64
cc helpers/worker/worker.c -o helpers/worker/binaries/macos-arm64/worker
```

On Windows use a Visual Studio developer shell for your target architecture:

```powershell
New-Item -ItemType Directory -Force helpers/worker/binaries/windows-arm64
cl /O2 /MT helpers/worker/worker.c /Fe:helpers/worker/binaries/windows-arm64/worker.exe
```

Add the applicable entries to `desktop.config.json`:

```json
{
  "helpers": {
    "worker": {
      "macos-arm64": { "directory": "helpers/worker/binaries/macos-arm64", "executable": "worker" },
      "windows-arm64": { "directory": "helpers/worker/binaries/windows-arm64", "executable": "worker.exe" }
    }
  }
}
```

Use `windows-x64` with an x64 build when appropriate. Build a **development runtime**
with your helper, then run the app's macOS/Windows script. An ordinary shared prebuilt
runtime does not contain app-supplied helpers. This example is desktop-only.

The client waits for `ready 1`, correlates replies by request ID, and handles split
or coalesced stdout chunks. The wire protocol is ASCII lines with hex-encoded binary
payloads, so UTF-8 characters and binary bytes never depend on pipe chunk boundaries.
Limits are 16 KiB per request, 32 pending requests, bounded frames, and 4 KiB of
retained live diagnostics. Request and readiness deadlines terminate a stuck helper
and reject pending work. A protocol failure also ends the session. There is no
silent restart/replay: a request may already have had side effects.

`service.ts` owns one helper for all consumers in the JS runtime. Call
`stopHelper()` before restarting; the UI makes this explicit. The root example
stops its service on unmount/Fast Refresh. In a multiwindow app keep this ownership
at application scope, not in each window. Framework runtime teardown/normal quit
also terminates owned processes. See [sidecar lifecycle limits](../../docs/sidecars.md),
including abrupt macOS app death. A helper is not a durable background service.

Validation:

- `bun test tests/sidecar-client.test.ts` (from the framework root) compiles the real
  worker on macOS/Linux and tests fragmented replies, concurrent requests, binary
  echo, graceful close, crash/restart, and readiness/request timeouts. This portable
  harness is skipped on Windows, where a Visual Studio-built binary is required.
- `bun scripts/test-sidecars.ts` packages both helpers into a disposable copy of the
  Kitchen Sink development runtime and checks the real native process transport.
- On Windows compile both `echo.c` and `worker.c`, declare both helper bundles in
  your Kitchen Sink development project, and run the sidecar acceptance path in
  [the helper documentation](../../docs/sidecars.md). Native Windows acceptance is
  still pending; C compilation on macOS is not proof of Windows behavior.
