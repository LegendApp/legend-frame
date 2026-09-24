# Desktop SDK implementation

Scope: app lifecycle/windows; filesystem/settings with Go isolation; context menus,
focused-app shortcuts/clipboard; URL/document opening and secure storage; a kitchen
sink app and automated unit, native and workflow coverage. macOS 14+, arm64.

Keep each native capability in a separate pod and desktop subpath. The small
app-context pod is mandatory host infrastructure. Go contains the complete SDK;
custom dev builds contain installed native dependencies; distribution keeps the
production import graph. Window routes must be reachable from the app entry.

Project identity is a stable UUID in app configuration. Go receives it from the
CLI; custom apps embed it through CNG. App data, settings, spark restoration and
Keychain services use a hash of this identity. This prevents accidental collisions,
not hostile code access: Go and direct-distribution apps are not OS sandboxes.

Work checklist:
- [x] SDK native and TypeScript APIs
- [x] CNG identity, associations and Go compatibility
- [x] Kitchen sink and native check runner
- [x] Unit and integration tests
- [x] Debug Go and reduced production graph validation
- [ ] Final custom Save/accepted-quit UI acceptance and normal kitchen sink UI inspection
- [x] Usage/API documentation and evidence

See [SDK validation](sdk-validation.md) for executed checks and the outstanding UI gate.
