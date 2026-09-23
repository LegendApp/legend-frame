# App-supplied helper processes

spark packages and launches executables supplied by the application. It does not
include Node, choose a backend language, download binaries, or compile helper
projects. A Rust, Go, C/C++, or self-contained executable can use the same API.
A runtime-dependent executable must bring its runtime and dependent files.

## Configuration and layout

```json
{
  "helpers": {
    "backend": {
      "macos-arm64": { "directory": "helpers/backend/macos-arm64", "executable": "bin/backend" },
      "windows-arm64": { "directory": "helpers/backend/windows-arm64", "executable": "backend.exe" },
      "windows-x64": { "directory": "helpers/backend/windows-x64", "executable": "backend.exe" }
    }
  }
}
```

Put this under `desktop.config.json`. Existing Expo-owned projects use the same
spark overlay. Selection uses the **build target**, including
`SPARK_WINDOWS_ARCH`, rather than the architecture of the running CLI process.
A missing target fails the build. macOS currently builds arm64; accepting a
`macos-x64` declaration does not add x64 app-build support.

`directory` is relative to the project; `executable` is relative to that directory.
Keep assets, shared libraries, and child executables in the bundle. Entries must
be plain files/directories, with no symlinks, traversal, or special files. Helper
names are case-insensitively unique. `.spark-entry` is reserved metadata.
Legacy `"helpers": { "tool": "bin/tool" }` declarations still copy one file.

The layout is `Contents/Helpers/backend.helper/...` on macOS and
`Helpers/backend.helper/...` beside the Windows host executable. Internal relative
paths are preserved. Native lookup resolves `helper:backend` through the generated
entry metadata; application code does not depend on installation paths. Resolve
read-only assets relative to the executable, not the inherited working directory.
Write mutable data into application storage, never into the installed bundle.

Every bundled file contributes to build compatibility, so changing an asset or
library requires rebuilding, just like changing the helper executable. Helpers
require a custom application binary; they cannot extend a shared Frame Runner
at JavaScript startup. Fast Refresh still handles JavaScript-only edits.

## API and ownership

```ts
import { spawn } from '@legendapp/spark/processes';

const child = await spawn({ executable: 'helper:backend', args: ['--stdio'] }, chunk => {
  // chunk.stream is stdout or stderr; chunk.base64 contains bytes.
});
await child.write('a request\n');
await child.closeInput();
const result = await child.exited;
```

`spawn` means the operating system launched the executable; it does not mean the
service is ready. Use an application-level readiness message and timeout when
needed. Each call starts a new process. Keep one process handle in an app-level
service if several windows need it; do not spawn from every screen render.
Closing one window does not own or terminate this service. Effect-owned processes
should call `terminate()` from cleanup, including during Fast Refresh.

Processes belong to the native module/runtime, not a durable background service.
A full runtime teardown stops them; normal application quit stops them.
`terminate()` requests termination; await `exited` to wait for completion.
On macOS cancellation sends SIGTERM to the process group, followed by SIGKILL
if it is still running after two seconds. Root-process exit kills remaining group
members so descendants cannot hold output pipes open forever. Children must not
escape the group by daemonizing. Abrupt app crashes/SIGKILL do **not** currently
guarantee macOS cleanup. Do not use this as an OS service manager.
Windows uses a kill-on-close Job Object; root exit and cancellation terminate the
job, and OS handle cleanup also covers abrupt app death. Descendant behavior and
runtime teardown still need native Windows acceptance testing.

Arguments bypass a shell. Environment overrides merge with the inherited process
environment; do not put secrets in command-line arguments. `cwd` is an optional
absolute working directory. `input` and `write()` accept UTF-8 strings; arbitrary
binary stdin is not a public API yet. Writes resolve after the native pipe write,
so await them rather than queuing unbounded writes.

Output callbacks receive base64 chunks of arbitrary boundaries. Decode bytes and
spark messages yourself; a chunk is neither a UTF-8 character boundary nor a JSON
message boundary. Both streams continue draining after their captured result
reaches 8 MiB per stream; `outputTruncated` reports that cap. Streaming callbacks
still receive the full output. Use `stdoutBase64`/`stderrBase64` for captured binary
output; text fields are conveniences. Startup failures reject `spawn`; nonzero
exit codes are reported through `exited`. `runCommand` closes stdin and waits for
exit. No automatic retry or restart policy is imposed.

## Distribution

Bundles are copied before macOS signing. The existing signing traversal signs
nested Mach-O executables and libraries inside out before signing the app; use
`signing`'s existing nested entitlement overrides for helper-specific needs. For
example, the target path is `Contents/Helpers/backend.helper/bin/backend`.
Do not grant a helper the app's entitlements implicitly. Configure library load
paths relative to the executable/bundle when building the helper.
Whole-app distribution carries the matching helper version with it.

Windows development products include helper bundles. Windows production
packaging, signing, and whole-app updates remain a separate framework gap; this
feature does not claim to implement that pipeline.

## Example and verification

See [the standalone C example](../examples/sidecar/README.md). On macOS:

```sh
npm run spark -- build --dev --project examples/kitchen-sink
node scripts/test-sidecars.ts
```

The probe copies the built app, installs the compiled example bundle, ad-hoc signs
it, runs real React Native API checks, and removes the disposable app. Logs and
`report.json` stay under `.spark/sidecar-tests`. It tests helper lookup, failures,
Unicode input, binary output beyond the capture cap, timeout, window ownership,
macOS descendant cleanup, prompt readiness delivery, and cleanup of a live helper
on normal application quit. It does not validate Developer ID notarization or
abrupt macOS crash cleanup.

On Windows, compile `echo.c` and `worker.c` for the host target, add both to Kitchen Sink's helpers
configuration using the example, build a **custom development app**, and launch
its executable with `--spark-test-report <absolute-report-path>
--spark-sidecar-probe` while Metro is running. The portable probe covers lookup,
I/O, failures, timeout, window ownership, and the worker readiness/request protocol. Separately verify Job Object cleanup
by closing/reloading the host and by killing the host while helpers and their
children are running. These native Windows results are pending.

## Request/response service example

The [sidecar example](../examples/sidecar/README.md#complete-requestresponse-example)
now includes a worker executable, bounded client protocol, application-owned service,
and a React Native UI. It demonstrates readiness, correlated concurrent requests,
binary-safe framing, timeouts, crash handling, explicit restart, and graceful stop.
These remain example-owned policies; the framework process API stays language- and
protocol-neutral. For large input files, use [streaming file I/O](file-streams.md)
or pass a validated path to an app-owned helper instead of one enormous message.

Validated on macOS on 2026-09-17: the real native sidecar probe passed all nine
checks, including binary worker requests, crash/restart, readiness/request timeouts,
and normal app-quit cleanup. Portable client tests also split replies into three-byte
fragments to exercise framing independently of OS pipe chunking.
