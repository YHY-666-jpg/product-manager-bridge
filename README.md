# Product Manager Bridge

Product Manager Bridge is a plan-first VS Code extension for AI-assisted engineering work. It collects local project context, asks an Architect model to produce a structured JSON plan, asks a Validator model to review that plan, then lets the user copy, save, or hand the approved task to Roo Code or Codex.

The extension is designed for teams that want an AI workflow with explicit planning, validation, custom rules, and safety checks before implementation begins.

## Features

- Activity Bar view: `Product Manager Bridge`
- OpenAI-compatible and Anthropic-compatible providers
- Default DeepSeek-compatible settings
- API keys stored in VS Code SecretStorage
- Context collection from workspace tree, active file, visible editors, `@file` references, git status, and git diff
- Architect prompt plus Validator prompt pipeline
- Zod schema validation for plans and validation output
- Policy validation for unsafe files, dangerous commands, large changes, and missing tests
- Custom project rules
- Prompt eval harness for regression testing prompt behavior
- Roo Code integration through VS Code commands
- Codex integration through the VS Code Codex extension, clipboard, or prompt file

## Quick Install

For a local VSIX build:

```bash
npm install
npm run compile
npm run test
npm run package
code --install-extension product-manager-bridge-0.1.0.vsix --force
```

Windows users can also double-click:

```text
build-vsix.bat
```

For a step-by-step user guide, see [docs/INSTALL.md](docs/INSTALL.md). Chinese users can also read [docs/USER_GUIDE.zh-CN.md](docs/USER_GUIDE.zh-CN.md).

## First Run

1. Open a project folder in VS Code.
2. Open the Product Manager Bridge icon in the Activity Bar.
3. Configure Architect and Validator providers.
4. Save both API keys.
5. Click `Test` for both providers.
6. Enter a requirement, optionally referencing files with `@src/file.ts`.
7. Click `Generate Plan`.
8. Review the plan and validation result.
9. Use `Copy Plan`, `Save Plan`, `Send to Roo Code`, or `Send to Codex`.

## Recommended Provider Settings

DeepSeek OpenAI-compatible example:

```text
Base URL: https://api.deepseek.com
Architect model: deepseek-v4-pro
Validator model: deepseek-v4-flash
Provider format: OpenAI Compatible
```

Anthropic-compatible example:

```text
Base URL: https://api.anthropic.com
Model: claude-3-5-sonnet-latest
Provider format: Anthropic Compatible
```

## Custom Rules

Custom Rules add project-specific constraints to the Architect and Validator. Example:

```text
Prefer minimal, reviewable changes.
Do not modify .env, private keys, certificates, or generated files.
Do not add third-party dependencies unless explicitly requested.
For database, network, concurrency, or filesystem changes, include rollback steps and tests.
```

Custom Rules can make the plan stricter, but cannot bypass the built-in PolicyValidator.

## Roo Code Integration

Product Manager Bridge calls the configured Roo Code VS Code command, defaulting to:

```text
roo-cline.newTask
```

The extension sends a `{ prompt }` payload and does not automate Roo Code's Webview DOM.

## Codex Integration

Product Manager Bridge supports several Codex delivery modes through `pmBridge.codex.delivery`:

- `vscode-sidebar` opens the VS Code Codex sidebar and copies the validated task to clipboard. This is the default release mode.
- `vscode-panel` opens a new Codex agent panel and copies the task.
- `vscode-implement-todo` uses Codex's `Implement with Codex` command as an experimental one-click transfer path.
- `prompt-file` only writes `.pmbridge/outbox/codex-task.md`.
- `clipboard` only copies the task.

Product Manager Bridge does not call the Codex CLI by default and does not read Codex credentials.

## Prompt Eval

Run prompt regression tests in offline mock mode:

```bash
npm run eval:prompts:mock
```

Run live model evals when API keys are configured in the environment:

```bash
npm run eval:prompts
```

Reports are written to:

```text
evals/reports/latest.json
evals/reports/latest.md
```

## Development

```bash
npm install
npm run compile
npm run test
npm run eval:prompts:mock
```

Open this folder in VS Code, press `F5`, and choose the Product Manager Bridge extension launch configuration.

## Safety Model

- API keys are stored only in VS Code SecretStorage.
- SecretScanner redacts common tokens, private keys, GitHub tokens, and database URLs.
- PolicyValidator blocks dangerous files, dangerous commands, `.git`, `node_modules`, generated outputs, and oversized plans.
- The extension requires user confirmation before sending approved plans to Roo Code or Codex.
- Product Manager Bridge does not modify project files itself.

## License

MIT
