# Limia

Limia is a lightweight Electron app for macOS and Windows that monitors local AI coding usage. It currently supports Kiro and Codex.

## How it works

Limia reads Kiro CLI session metering data and requests Codex rate-limit percentages using the user's existing local Codex session. It does not read or transmit prompts or source code, and never exposes authentication tokens to the renderer.

Supported local roots:

- Kiro CLI: `~/.kiro/sessions/cli`
- Codex: `CODEX_HOME` or `~/.codex`

## Development

```sh
npm install
npm run check
npm run dev
```

## Packaging

Build macOS artifacts on macOS and Windows artifacts on Windows:

```sh
npm run package:mac
npm run package:win
```

Artifacts are written to `release/`.

The default targets are Apple Silicon for macOS and x64 for Windows. Use
`package:mac:x64` or `package:win:arm64` for the alternate architectures.

## Downloads

Published installers are available on the [GitHub Releases](https://github.com/sidneylima/ia-viewer/releases) page. Each release includes a macOS Apple Silicon DMG and ZIP, plus Windows x64 NSIS installer and portable executable.

To publish version `0.1.0`, create and push the tag `v0.1.0`. GitHub Actions will build both platforms and attach the files to the release automatically.

The macOS workflow creates an unsigned DMG for direct download; it does not use the Apple App Store or Apple signing secrets. Because the downloaded app is unsigned, macOS requires a manual approval after installation:

1. Open the DMG and drag `Limia` to `Applications`.
2. In Finder, right-click `Limia.app` and choose `Open`.
3. Confirm with `Open` in the security dialog.

If macOS still blocks the app, remove the download quarantine with:

```sh
xattr -dr com.apple.quarantine "/Applications/Limia.app"
```
