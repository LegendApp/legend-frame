# Legend Spark

**Experimental — not ready for production use.** APIs, native implementations, and tooling may change.

Legend Spark adds native desktop APIs and a managed development workflow to React Native and Expo Desktop. Application JavaScript runs in Hermes; Node is not embedded.

## Try the experimental release

You need Node 24.19.0 or newer. The npm package supplies the public API and `spark` command; the matching macOS Apple Silicon Runner downloads automatically on first launch.

```sh
npx @legendapp/spark@next create MyApp
cd MyApp
npm run macos
```

The development command downloads and caches a compatible Runner automatically. JavaScript edits use Fast Refresh; native changes require rebuilding.

macOS on Apple Silicon is the primary experimental target. Windows development implementations still need native acceptance; Windows production builds are not supported. Mobile and web use Expo workflows with selected shared adapters.

[Documentation](https://legend.so/spark) · [Source and current setup guide](https://github.com/LegendApp/legend-spark) · [Known Windows limitations](https://github.com/LegendApp/legend-spark/blob/main/docs/windows-issues.md)
