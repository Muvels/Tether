# Releasing Tether

This document describes what is needed to create a release for `Tether`, what the GitHub Actions pipeline does, and the exact steps to publish a new version.

## Release Model

- Regular branch pushes build installable artifacts for macOS, Linux, and Windows and upload them as workflow artifacts.
- Git tags matching `v*` publish a stable GitHub Release.
- The macOS app updater checks GitHub Releases for newer stable versions.
- The release source of truth is the `version` field in `package.json`.

## What The Workflow Uses

The release pipeline is defined in [`/.github/workflows/release.yml`](/Users/matteomarolt/Developer/pdf-canvas-linker/.github/workflows/release.yml:1).

It runs on:

- `push` to any branch
- `push` of tags like `v0.1.0`
- manual `workflow_dispatch`

It builds these targets:

- macOS: `--mac --universal`
- Linux: `--linux AppImage`
- Windows: `--win nsis`

## Required GitHub Secrets

### Always available

- `GITHUB_TOKEN`
  This is the built-in GitHub Actions token. The workflow uses it through `GH_TOKEN` to publish GitHub Releases on tag builds. No manual setup is needed.

### Required for production macOS signing and notarization

Add these repository secrets in GitHub under `Settings -> Secrets and variables -> Actions`:

- `APPLE_SIGNING_CERTIFICATE`
  Base64-encoded `.p12` Developer ID Application certificate.
- `APPLE_SIGNING_CERTIFICATE_PASSWORD`
  Password for the `.p12` certificate.
- `APPLE_ID`
  Apple Developer account email used for notarization.
- `APPLE_APP_SPECIFIC_PASSWORD`
  App-specific password for the Apple ID above.
- `APPLE_TEAM_ID`
  Apple Developer Team ID.

## What Is Needed Before A Real Public macOS Release

The pipeline already accepts Apple signing secrets, but a real production-grade macOS release also depends on:

- an active Apple Developer membership
- a valid `Developer ID Application` certificate exported as `.p12`
- notarization credentials
- `electron-builder` signing/notarization configuration being complete for the repo

Current status:

- unsigned or ad-hoc signed macOS builds can be produced now
- GitHub Releases can be published now
- production distribution to other Macs should wait until signing and notarization are fully configured and verified

## Release Checklist

Before cutting a release:

1. Make sure the branch is in the state you want to ship.
2. Update `package.json` `version` to the new release number.
3. Make sure the intended tag will match that exact version.
4. Run local verification:
   - `pnpm install`
   - `pnpm typecheck`
   - `pnpm lint`
   - optional: `pnpm dist` for a local packaging smoke test
5. Confirm GitHub repository secrets are present if this release is meant to be signed and notarized.

## How To Create A Release

Example for version `0.1.0`:

1. Update `package.json`:

```json
{
  "version": "0.1.0"
}
```

2. Commit the version bump:

```bash
git add package.json pnpm-lock.yaml
git commit -m "Release v0.1.0"
```

3. Create the matching git tag:

```bash
git tag v0.1.0
```

4. Push the branch and the tag:

```bash
git push origin <branch-name>
git push origin v0.1.0
```

5. Wait for the `Build and Release` workflow to finish on GitHub.

6. Verify the GitHub Release contains macOS updater artifacts:

- `Tether-<version>-universal-mac.zip`
- `Tether-<version>-universal-mac.zip.blockmap`
- `Tether-<version>-universal.dmg`
- `Tether-<version>-universal.dmg.blockmap`
- `latest-mac.yml`

## What Happens On Each Pipeline Type

### Branch push

- Builds macOS, Linux, and Windows packages
- Does not publish a GitHub Release
- Uploads `release/**` as workflow artifacts

### Manual workflow run

- Same as a normal branch run unless started from a tag ref

### Tag push like `v0.1.0`

- Builds macOS, Linux, and Windows packages
- Publishes artifacts to a GitHub Release
- Produces the metadata used by the macOS auto-updater

## Local Commands

Useful local commands:

```bash
pnpm build
pnpm lint
pnpm typecheck
pnpm dist
pnpm release
```

Notes:

- `pnpm dist` builds and packages locally without publishing.
- `pnpm release` builds and publishes through `electron-builder`, but the normal release path for this repo should be the GitHub tag workflow.

## Post-Release Verification

After the workflow succeeds:

1. Open the GitHub Release page and confirm all expected artifacts are attached.
2. Confirm `latest-mac.yml` exists in the release assets.
3. Install an older macOS version of the app.
4. Launch the older app and use `Settings -> Automatic updates`.
5. Confirm it detects the new version, downloads it, and offers restart/install.

## Failure Cases To Check First

If a release fails, check these first:

- the git tag does not match `package.json` version
- Apple secrets are missing or invalid
- the GitHub Action lacks `contents: write`
- the build passed locally but the GitHub runner hit a platform-specific packaging issue
- `latest-mac.yml` was not generated, which usually means the macOS zip target was not produced
