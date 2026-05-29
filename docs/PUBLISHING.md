# Releasing Product Manager Bridge

This document explains how to prepare Product Manager Bridge as an open source GitHub project and how to build a local VSIX package for manual installation.

## 1. Prepare Repository Metadata

Before publishing the repository, update `package.json`:

```json
{
  "repository": {
    "type": "git",
    "url": "https://github.com/YHY-666-jpg/product-manager-bridge.git"
  },
  "bugs": {
    "url": "https://github.com/YHY-666-jpg/product-manager-bridge/issues"
  },
  "homepage": "https://github.com/YHY-666-jpg/product-manager-bridge#readme"
}
```

## 2. Initialize GitHub Repository

```bash
git init
git add .
git commit -m "Initial open source release"
git branch -M main
git remote add origin https://github.com/YHY-666-jpg/product-manager-bridge.git
git push -u origin main
```

## 3. Verify Locally

```bash
npm install
npm run compile
npm run test
npm run eval:prompts:mock
npm run package
```

Install the generated VSIX:

```bash
code --install-extension product-manager-bridge-0.1.0.vsix --force
```

## 4. Create a GitHub Release

1. Make sure `CHANGELOG.md` describes the release.
2. Build `product-manager-bridge-0.1.0.vsix`.
3. Open the GitHub repository.
4. Create a new release tag, for example `v0.1.0`.
5. Upload the generated `.vsix` as a release asset.
6. Include installation instructions that point users to `docs/INSTALL.md`.

## 5. Release Checklist

- `README.md` explains the project clearly.
- `CHANGELOG.md` includes the new version.
- `LICENSE` is present.
- `repository`, `bugs`, and `homepage` point to the public GitHub repo.
- `npm run compile` passes.
- `npm run test` passes.
- `npm run eval:prompts:mock` passes.
- Generated `.vsix` installs locally.
- No secrets, `.env`, logs, or local API keys are committed.

## 6. Versioning

Use semantic versioning:

```bash
npm version patch
npm run package
```

For breaking changes, use `minor` or `major` instead of `patch`.

## 7. Notes About Codex Integration

The default release setting is:

```text
pmBridge.codex.delivery = vscode-sidebar
```

This avoids depending on Codex CLI and avoids DOM automation. The `vscode-implement-todo` mode is intentionally documented as experimental because it relies on a VS Code command contributed by the Codex extension.
