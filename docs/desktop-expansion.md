# Desktop API expansion

Authorized scope: stages 1–4 from the desktop API comparison. macOS 14+, arm64,
Hermes, no bundled Node. Keep each native capability independently linkable.

- [x] Framework-owned config, validation/schema, Go/CNG/build integration
- [x] Window styles, constraints, child/modal windows, display events
- [x] Global shortcuts, drag/drop, processes and helper packaging
- [x] Rich dialogs/clipboard, login startup, Dock, power events
- [x] WebView and SQLite integration
- [x] Kitchen sink, automated JS/config/codegen/native coverage
- [x] Documentation and refreshed local SDK/Go artifacts

See [validation evidence and remaining OS-level acceptance](desktop-expansion-validation.md)
and the [configuration/API guide](desktop-api-expansion.md).

Implementation and automated coverage are complete. Manual cross-app drag/drop,
global hotkey delivery, login startup approval and physical power/display events
remain acceptance checks on an unlocked desktop.
