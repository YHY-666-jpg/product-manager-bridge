# Contributing

Thanks for helping improve Product Manager Bridge.

## Development Setup

```bash
npm install
npm run compile
npm run test
npm run eval:prompts:mock
```

Open the repository in VS Code and press `F5` to launch an Extension Development Host.

## Pull Request Checklist

- Keep changes scoped.
- Add or update tests for behavior changes.
- Run `npm run compile`.
- Run `npm run test`.
- Run `npm run eval:prompts:mock` when prompts, schemas, validation, or context collection change.
- Do not commit `.env`, API keys, logs, `node_modules`, `dist`, or VSIX files.

## Prompt Changes

Prompt changes must preserve these guarantees:

- Do not invent files.
- Request `required_files` and `missing_context` when context is insufficient.
- Prefer evidence quotes from provided context.
- Validator must reject or request revision for unsafe, unsupported, or hallucinated plans.

## Security Changes

Changes to `src/security`, `src/llm`, context collection, file IO, or external integrations should explain:

- risk introduced
- rollback path
- tests added
- user-facing behavior
