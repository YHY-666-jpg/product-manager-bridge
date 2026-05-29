# Security Policy

## Supported Versions

The latest Marketplace version receives security fixes.

## Reporting a Vulnerability

Please open a private security advisory on GitHub or contact the maintainers listed in the repository.

Do not publish API keys, tokens, private repository contents, or sensitive logs in public issues.

## Security Design

Product Manager Bridge is designed to reduce unsafe AI automation:

- API keys are stored in VS Code SecretStorage.
- API keys are not shown in the Webview.
- SecretScanner redacts common secrets before model calls.
- PolicyValidator blocks dangerous files and commands.
- Plans must pass schema validation.
- Plans must pass Validator review before handoff.
- Roo Code and Codex handoff require user confirmation.
- Product Manager Bridge does not directly modify the workspace source code.

## Known Boundaries

Product Manager Bridge sends selected project context to the configured model provider. Users should verify their provider and data policy before using the extension with private or regulated codebases.

Codex and Roo Code integrations use their VS Code extension commands. Product Manager Bridge does not access their internal credentials or automate their Webview DOM.
