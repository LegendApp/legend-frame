# Legend Spark naming and prototype migration

The framework is **Legend Spark**; its short name and CLI command are **spark**.
The public npm package is `@legendapp/spark`; implementation packages use
`@legendapp/spark-*`. Other Legend projects and third-party dependencies retain
their names, including Sparkle (the macOS updater).

## Local development

From this checkout:

```sh
bun install
bun run spark sdk pack
bun run spark sdk build-prebuilt
bun run spark create /path/to/MyApp
```

Once published, the intended entry point is `bunx @legendapp/spark create MyApp`
(or `npx @legendapp/spark create MyApp` with Bun installed). Packages are not
published by this rename. Creation still requires a locally packed or imported
SDK; automatic runtime downloads remain separate work.

## Moving from Frame

This is a breaking prototype rename. Old generated native projects and prebuilt
binaries must be rebuilt. No compatibility package aliases are provided.

| Previous | Current |
| --- | --- |
| Legend Frame / `frame` | Legend Spark / `spark` |
| `@legendapp/frame` | `@legendapp/spark` |
| `@legendapp/frame-*` | `@legendapp/spark-*` |
| `.frame/`, `~/.frame/` | `.spark/`, `~/.spark/` |
| `FRAME_*` environment variables | `SPARK_*` |
| `frame` package metadata / Expo extras | `spark` |
| `withFrameExpo` | `withSparkExpo` |
| `FramePrebuilt.app` | `SparkPrebuilt.app` |
| `frame-runtime.json` | `spark-runtime.json` |

`desktop.config.json` retains its filename. Window geometry (`Frame`, `frame`,
`setWindowFrame`) and camera frame APIs retain their names and behavior.

Update imports, dependency names, scripts, config wrappers, Expo extras and custom
environment settings together. Regenerate native projects from the Spark starter,
preserving and reapplying application-specific configuration. Repack exported SDK
bundles rather than mixing Frame and Spark archives.

Old `.frame` and `.legend` directories remain ignored and are not deleted or moved.
Local SDK registration and application-data namespaces now use Spark. Save any
prototype application data you need before switching; this rename does not migrate
stored data, credentials, or OS registrations automatically.

For Kitchen Sink, install at the repository root, then:

```sh
cd examples/kitchen-sink
bun run rebuild:macos  # or rebuild:windows, on Windows
bun run macos         # or windows
```

Follow the [manual acceptance checklist](desktop-manual-acceptance.md) after rebuilding.
The [previous Frame validation report](frame-rename-validation.md) is historical
and does not establish native acceptance for Spark.
