# Remaining Windows parity implementation

Continue the agreed priority list, preserving the existing public macOS contracts
and using replaceable Windows backends. One commit per group. Native acceptance
is performed on Windows; generation and bundling never imply runtime success.

- [x] 1. Filesystem and persistent settings (`99cc5d7`).
- [x] 2. Native message dialogs and context menus (`6fcdee8`).
- [ ] 3. Drag/drop, recent documents, file/URL associations. Recent documents and associations implemented; native drag/drop remains.
- [x] 4. Tray and global shortcuts (source implementation; native acceptance pending).
- [ ] 5. Notifications and response lifecycle.
- [x] 6. Owned/modal windows and fuller menus (source implementation; native acceptance pending).
- [ ] 7. Processes and system APIs.
- [ ] 8. Nitro, SQLite, WebView, secondary Hermes runtimes.
- [x] 9. Rich clipboard and development connection/bundle options (source implementation; native acceptance pending).

Standalone distribution was deferred for the internal development slice; the
current task asks whether to include it. Track actual native limitations in
[windows-issues.md](windows-issues.md), with shared acceptance evidence in
[platform-testing.md](platform-testing.md).
