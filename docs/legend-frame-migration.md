# Legend Frame naming and prototype migration

The framework is **Legend Frame**. Its short name and command are **frame**.
The public npm package is `@legendapp/frame`; implementation packages use
`@legendapp/frame-*`. Other Legend projects and third-party packages keep their
own names.

The intended published entry point is:

```sh
bunx @legendapp/frame create MyApp
# Or, with Node/npm and Bun installed:
npx @legendapp/frame create MyApp
```

The public package now includes the `frame` executable. It delegates to the
internal CLI, which still requires Bun 1.3.14+. Publishing the packages and hosting
runtime downloads remain separate work. Creation currently needs a locally packed
or imported SDK; these commands do not imply npm availability or automatic runtime
downloads today. Starter selection retains its existing behavior: `--universal`
selects the shared five-platform Settings project, and `--example notes-lite`
selects a universal example. Default creation still chooses the host's starter.

## Existing checkouts and consumers

This is a breaking prototype rename. Keep any application data you need before
switching. There are no compatibility aliases for the old npm package names or
native runtime identities.

| Previous | Current |
| --- | --- |
| `legend` command | `frame` |
| `@legend-apps/desktop/<feature>` | `@legendapp/frame/<feature>` |
| `@legend-apps/ui` | `@legendapp/frame/ui` (implementation: `@legendapp/frame-ui`) |
| `@legend-apps/cli` | `@legendapp/frame-cli` (implementation package) |
| Other `@legend-apps/<module>` | `@legendapp/frame-<module>` |
| `.legend/`, `~/.legend/` | `.frame/`, `~/.frame/` |
| `LEGEND_*` environment variables | `FRAME_*` |
| `legend` package metadata / Expo extras | `frame` |
| `withLegendExpo` config wrapper | `withFrameExpo` |
| `LegendGo.app` | `FramePrebuilt.app` |

`desktop.config.json` keeps its filename. Generated native identifiers, codegen
names, helper protocols and runtime metadata have changed, so old binaries are
incompatible. Existing generated app/config files with old managed markers should
be regenerated from the new starter; preserve and reapply custom Expo/config logic.
The repository's old `.legend` artifacts remain ignored and are not deleted or
migrated automatically. Old logs/reports still live at their original paths.

From the framework checkout, reinstall and repack:

```sh
bun install --force
bun run frame sdk pack
bun run frame sdk build-prebuilt
bun run frame create /path/to/FreshApp --universal
```

Use `--platform windows` on Windows where appropriate. For Kitchen Sink:

```sh
cd examples/kitchen-sink
bun run rebuild:macos  # or rebuild:windows
bun run macos         # or windows
```

Update imports, dependency names, overrides, package scripts and custom environment
settings together. If you previously exported an SDK bundle, export a new bundle;
do not mix archives or runtime registrations across the rename. App-data namespaces
in the prototypes also changed; data is not automatically moved into the new ones.

After rebuilding, follow the [manual acceptance checklist](desktop-manual-acceptance.md).

See the [rename validation report](frame-rename-validation.md) for executed checks and remaining limits.
