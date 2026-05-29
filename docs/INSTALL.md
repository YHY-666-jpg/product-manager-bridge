# Product Manager Bridge Install Guide

This guide is for users who install Product Manager Bridge from a local `.vsix` file.

## Requirements

- VS Code 1.90.0 or newer
- A project folder opened in VS Code
- An API key for at least one OpenAI-compatible or Anthropic-compatible provider
- Optional: Roo Code extension, if you want `Send to Roo Code`
- Optional: OpenAI Codex VS Code extension, if you want `Send to Codex`

## Install from VSIX

1. Download or build `product-manager-bridge-0.1.0.vsix`.
2. Open VS Code.
3. Open `Extensions`.
4. Click `...`.
5. Choose `Install from VSIX...`.
6. Select the `.vsix` file.
7. Run `Developer: Reload Window`.

Command-line install:

```bash
code --install-extension product-manager-bridge-0.1.0.vsix --force
```

## First-Time Setup

1. Open your target project folder in VS Code.
2. Click the `Product Manager Bridge` icon in the Activity Bar.
3. In `API Provider`, choose `OpenAI Compatible` or `Anthropic Compatible`.
4. Enter the Base URL and model for Architect.
5. Enter the Base URL and model for Validator.
6. Click `Set Key` for Architect and Validator.
7. Click `Test` for both providers.

DeepSeek example:

```text
Base URL: https://api.deepseek.com
Architect model: deepseek-v4-pro
Validator model: deepseek-v4-flash
```

## Generate Your First Plan

1. In `Requirement`, describe the change you want.
2. Reference important files with `@path/to/file`.
3. Click `Generate Plan`.
4. Watch the stage banner. Product Manager Bridge will show context collection, Architect thinking, Validator checking, and approval/revision status.
5. Read the `Plan Result`.
6. If approved, choose one of:
   - `Copy Plan`
   - `Save Plan`
   - `Send to Roo Code`
   - `Send to Codex`

## Send to Roo Code

Install Roo Code first. Product Manager Bridge defaults to:

```text
roo-cline.newTask
```

If Roo changes its command name, set `pmBridge.rooCommand` in VS Code Settings.

## Send to Codex

Install and sign in to the OpenAI Codex VS Code extension first.

Default mode:

```text
pmBridge.codex.delivery = vscode-sidebar
```

This opens Codex and copies the approved task to your clipboard. Paste the task into the Codex composer if it is not inserted automatically.

Experimental one-click mode:

```text
pmBridge.codex.delivery = vscode-implement-todo
```

This uses Codex's `Implement with Codex` command and may change if the Codex extension changes its internal command behavior.

## Troubleshooting

`fetch failed`

Product Manager Bridge now expands fetch errors with provider, URL, and cause details. Check:

- Base URL
- API key
- proxy or VPN
- firewall
- DNS
- certificate interception
- model name

`HTTP 401`

The API key is missing, invalid, or does not have access to that provider/model.

`Plan needs revision`

The Validator found missing context, unsafe commands, missing tests, nonexistent files, or custom rule violations. Provide the requested files or narrow the requirement.

`Send to Codex` opens Codex but does not paste automatically

The task is already copied to clipboard and saved at:

```text
.pmbridge/outbox/codex-task.md
```
