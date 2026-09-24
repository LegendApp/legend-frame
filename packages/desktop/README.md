# Legend Spark

**Experimental — not ready for production use.** APIs, native implementations, and tooling may change.

Legend Spark adds native desktop APIs and a managed development workflow to React Native and Expo Desktop. Application JavaScript runs in Hermes; Node is not embedded.

## Try the experimental release

You need Bun 1.3.14 or newer and the compatible Node version (currently 24.19.0).

The npm package supplies the public API and `spark` command. Creating an app also requires the matching SDK archive set. Download the SDK from the matching [GitHub prerelease](https://github.com/LegendApp/legend-spark/releases), extract it to a permanent location, and follow its installation instructions. Keep the SDK directory in place after installation.

```sh
# In the extracted SDK directory:
bun install.ts

# With that SDK registered:
bunx @legendapp/spark@next create MyApp
cd MyApp
bun run macos
```

The development command uses a compatible registered prebuilt runtime. If none is available, build a custom runtime with the native toolchain. JavaScript edits use Fast Refresh; native changes require rebuilding.

macOS on Apple Silicon is the primary experimental target. Windows development implementations still need native acceptance; Windows production builds are not supported. Mobile and web use Expo workflows with selected shared adapters.

[Documentation](https://legend.so/spark) · [Source and current setup guide](https://github.com/LegendApp/legend-spark) · [Known Windows limitations](https://github.com/LegendApp/legend-spark/blob/main/docs/windows-issues.md)
