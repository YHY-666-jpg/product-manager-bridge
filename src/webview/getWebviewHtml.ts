import * as vscode from "vscode";

export function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const nonce = cryptoNonce();
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "webview", "main.js"));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "dist", "webview", "styles.css"));
  const csp = [
    "default-src 'none'",
    `style-src ${webview.cspSource}`,
    `script-src 'nonce-${nonce}'`,
    `font-src ${webview.cspSource}`
  ].join("; ");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <link rel="stylesheet" href="${styleUri}">
  <title>Product Manager Bridge</title>
</head>
<body>
  <header>
    <h1>Product Manager Bridge</h1>
    <p>PM -> Architect -> Validator -> Executor</p>
  </header>

  <section>
    <label for="requirement">Requirement</label>
    <textarea id="requirement" rows="7" placeholder="Describe your engineering task. Use @src/file.ts to attach files."></textarea>
    <button id="generate">Generate Plan</button>
    <div id="stageBanner" class="stage-banner idle" aria-live="polite">
      <div class="stage-eyebrow">Current Stage</div>
      <div id="stageTitle" class="stage-title">Idle</div>
      <div id="stageMessage" class="stage-message">Waiting for a requirement.</div>
    </div>
    <div id="status" class="status">Ready.</div>
  </section>

  <section>
    <h2>Context Preview</h2>
    <pre id="context">{}</pre>
  </section>

  <section class="model-section">
    <h2>Model Provider Settings</h2>
    ${modelCard("architect", "Architect")}
    ${modelCard("validator", "Validator")}
  </section>

  <section>
    <details open>
      <summary>Custom Rules</summary>
      <label class="checkbox-row"><input type="checkbox" id="rulesEnabled"> Enable Custom Rules</label>
      <textarea id="rules" rows="8"></textarea>
      <div class="row">
        <span id="rulesCount">0 / 8000</span>
        <button id="saveRules">Save Rules</button>
        <button id="resetRules">Reset Rules</button>
        <button id="templateRules">Insert Default Template</button>
      </div>
    </details>
  </section>

  <section>
    <h2>Plan Result</h2>
    <pre id="result">No plan yet.</pre>
    <div class="row">
      <button id="copy">Copy Plan</button>
      <button id="save">Save Plan</button>
      <button id="send">Send to Roo Code</button>
      <button id="sendCodex">Send to Codex</button>
    </div>
  </section>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

function modelCard(role: "architect" | "validator", title: string): string {
  return `<article class="provider-card" data-role="${role}">
    <div class="provider-header">
      <h3>${title}</h3>
      <a href="https://platform.deepseek.com/api-docs/" title="Provider Docs">Provider Docs</a>
    </div>

    <label for="${role}Format">API Provider</label>
    <select id="${role}Format" data-field="format" data-role="${role}">
      <option value="openai-compatible">OpenAI Compatible</option>
      <option value="anthropic-compatible">Anthropic Compatible</option>
    </select>

    <label for="${role}BaseUrl">Base URL</label>
    <input id="${role}BaseUrl" data-field="baseUrl" data-role="${role}" type="url" spellcheck="false">

    <label for="${role}ApiKey">API Key</label>
    <input id="${role}ApiKey" data-field="apiKey" data-role="${role}" type="password" autocomplete="off" spellcheck="false">

    <label for="${role}Model">Model</label>
    <input id="${role}Model" data-field="model" data-role="${role}" list="${role}Models" spellcheck="false">
    <datalist id="${role}Models">
      <option value="deepseek-v4-pro"></option>
      <option value="deepseek-v4-flash"></option>
      <option value="deepseek-chat"></option>
      <option value="gpt-4o"></option>
      <option value="claude-3-5-sonnet-latest"></option>
    </datalist>

    <div class="provider-actions">
      <span id="${role}Key" class="key-state">API Key: Unknown</span>
      <button data-provider-save="${role}">Save</button>
      <button data-action="clearApiKey" data-role="${role}">Clear Key</button>
      <button data-action="testProvider" data-role="${role}">Test</button>
    </div>
  </article>`;
}

function cryptoNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let index = 0; index < 32; index += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
}
