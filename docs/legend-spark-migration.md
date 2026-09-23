# Legend Spark naming and prototype migration

The framework is **Legend Spark**; its short name and CLI command are **spark**.
The public npm package is `@legendapp/spark`; implementation packages use
`@legendapp/spark-*`. Other Legend projects and third-party dependencies retain
their names, including Sparkle (the macOS updater).

## Local development

From this checkout:

```sh
npm install --force
npm run spark -- sdk pack
npm run spark -- sdk build-runner
npm run spark -- create /path/to/MyApp
```

Once published, the intended entry point is `bunx @legendapp/spark create MyApp`
(or `npx @legendapp/spark create MyApp` with Node 24.19.0 or newer). Packages are not
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
npm run rebuild:macos  # or rebuild:windows, on Windows
npm run macos         # or windows
```

The Spark artwork lives at `assets/branding/legend-spark.png` and is included in
the starter templates at `assets/icon.png`.

Follow the [manual acceptance checklist](desktop-manual-acceptance.md) after rebuilding.
The [previous Frame validation report](frame-rename-validation.md) is historical
and does not establish native acceptance for Spark.

## Single public package

New applications depend on `@legendapp/spark` only. Replace direct implementation
dependencies and overrides such as `@legendapp/spark-ui` and
`@legendapp/spark-cli` with the single Spark SDK archive. Change application
imports to public subpaths (`@legendapp/spark/ui`, `@legendapp/spark/files`,
`@legendapp/spark/windows`, etc.) and configuration imports to the helpers listed
in [SDK distribution](sdk-distribution.md#public-package-layout). The generated
postinstall command is `node node_modules/@legendapp/spark/init-template.cjs`.

Native module names in explicit inclusion/exclusion configuration and compatibility
reports retain their private identities; those are not JavaScript import paths.
Use a fresh starter to compare custom configuration, and rebuild Runner from the
new SDK before launching it. Existing applications are not rewritten automatically.
