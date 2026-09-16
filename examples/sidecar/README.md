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
