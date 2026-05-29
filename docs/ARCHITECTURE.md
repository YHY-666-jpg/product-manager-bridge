# Architecture

Product Manager Bridge is a VS Code extension with a plan-first orchestration pipeline.

```text
VS Code Webview
  -> ContextBuilder
  -> Architect Prompt
  -> ModelRouter
  -> Plan Schema
  -> PolicyValidator
  -> Validator Prompt
  -> Validation Schema
  -> Copy / Save / Roo / Codex
```

## Main Modules

- `src/webview`: Webview HTML, styles, and message handling.
- `src/context`: Workspace tree, active file, visible files, git status, git diff, and explicit `@file` references.
- `src/prompts`: Architect and Validator prompt builders.
- `src/llm`: Provider config, OpenAI-compatible provider, Anthropic-compatible provider, API key storage, fetch diagnostics.
- `src/schema`: Zod schemas for Plan and Validator output.
- `src/security`: Secret scanning and policy validation.
- `src/orchestrator`: Architect -> parse -> policy -> Validator -> retry loop.
- `src/integrations`: Roo Code and Codex handoff adapters.
- `src/evals`: Prompt output auditor used by the eval runner.

## Safety Boundaries

Product Manager Bridge does not edit the user's project files. It produces validated plans and sends those plans to tools chosen by the user.

The extension blocks or warns on:

- dangerous commands
- secret files
- `.env`
- `.git`
- `node_modules`
- build outputs
- generated outputs
- missing tests for risky changes
- hallucinated file references in prompt evals

## Provider Flow

API keys are stored in VS Code SecretStorage. Provider settings are stored in normal VS Code configuration.

`ModelRouter` loads the role-specific API key and provider config, then creates either:

- `OpenAICompatibleProvider`
- `AnthropicCompatibleProvider`

Both provider implementations use `fetchDiagnostics` so network failures include URL, provider, HTTP body, timeout, and lower-level cause details.

## Prompt Eval Flow

`evals/run-evals.ts` loads cases from `evals/cases`, builds fixture project context, loads mock or live model output, then checks:

- JSON parse
- Zod schema
- PolicyValidator
- PromptOutputAuditor
- hallucinated files
- unsafe commands
- schema errors
- missing tests
- custom rule violations

Reports are written to `evals/reports`.
