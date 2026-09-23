# Frame preview releases

The npm package and Runner are artifacts of one SDK version. The public package
contains `release.json` inside its private CLI, pinning the patched dependency
URLs and the Runner archive's checksum, size, publisher team and native
fingerprint. Published projects use the SDK's exact registry version and HTTPS
archives. Explicit `create --packages <manifest>` retains local SDK development.

The initial hosted Runner target is macOS arm64. Windows requires a custom build
and remains experimental pending native acceptance. Users need Node 24.19+ and
a package manager, but do not need Xcode to download and open the hosted Runner.
Native builds and notarization require the maintainer's Apple toolchain.

## Prerequisites

- Select the preview version and update the workspace/private package versions,
  template Frame dependency pins and `VERSION` in the CLI together. Refresh the
  npm lockfile and run typecheck and tests before committing.
- Use a public distribution repository. The currently configured repository is
  `LegendApp/legend-spark`; its visibility must be made public explicitly before
  public downloads can work. Never change visibility implicitly in automation.
- Authenticate GitHub and npm with accounts allowed to release/publish.
- Install a Developer ID Application certificate and private key. Set
  `SPARK_DEVELOPER_ID_APPLICATION` and `SPARK_NOTARY_KEYCHAIN_PROFILE` to the
  chosen identity/profile references (or configure them with `spark credentials`).
  Keep secrets in Keychain; never commit signing credentials.

## Build and stage

From the clean, committed release revision on an Apple Silicon Mac:

```sh
npm ci
npm run release:runner
```

This packs the SDK and patched third-party archives, creates/refreshes the managed
Runner project, forces its native build and records the source revision, then
signs and notarizes a staging copy. It preserves the development runtime mode
and full native module set; it does not build a pruned standalone application.
The signed app passes nested signature, entitlement, architecture, notarization,
Gatekeeper and extracted-archive checks before release assembly.

If Apple is still processing, the command exits 2. Resume unchanged inputs with:

```sh
npm run release:runner -- --resume
```

Unknown submission outcomes require explicit recovery with
`spark sdk package-runner --submission-id <Apple submission UUID>`; do not retry
an uncertain submission by discarding its state. Existing signing/notarization
state remains in the managed project's `.spark/packaging` directory.

Successful assembly writes `artifacts/releases/<version>` containing the public
npm tarball, patched dependency tarballs, Runner ZIP, `runner-manifest.json`,
`checksums.txt` and a source-revision/artifact manifest. It refuses to overwrite
an existing release directory. The standalone `release:assemble` command accepts
an already signed ZIP produced from the same committed source revision.

## Publish preview

Push the reviewed release source and its matching `v<version>` tag to the public
repository first. The publisher requires that remote tag to point at the exact
staged revision. Then:

```sh
npm run release:publish
```

The publisher checks local checksums and public repository visibility, creates a
draft prerelease, uploads artifacts, checks GitHub's asset digests, publishes the
GitHub release, then publishes the exact assembled npm tarball with public access
under `next`. It never overwrites existing assets or moves tags. Resuming uploads
missing draft assets without replacing existing files. A checksum mismatch stops
for explicit repair; rerunning cannot replace released bytes.

## Acceptance before promotion

On another Apple Silicon Mac without the checkout, registered SDK, cached Runner,
Bun or Xcode:

```sh
npx @legendapp/spark@next create MyApp
cd MyApp
npm run dev
```

Press `d`. Verify download progress, automatic launch, Gatekeeper acceptance,
native controls, Fast Refresh, close/reopen and offline reuse of the cached app.
Clone the generated project into another directory and reinstall dependencies to
prove that no producer/cache paths are required. Repeat creation/install using
pnpm and Yarn. Test interrupted downloads and an incompatible native dependency;
the latter must request a custom development build rather than run incompatible
JavaScript. Record native UI acceptance separately from bundling/test results.

Only after acceptance, promote the exact tested version to npm's `latest` tag
and publish release notes. No automatic promotion is performed by these scripts.
