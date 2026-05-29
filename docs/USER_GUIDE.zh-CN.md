# Product Manager Bridge 用户引导

这份文档面向安装 Product Manager Bridge 后的普通用户，帮助你完成首次配置、生成计划，并把通过验证的计划交给 Roo Code 或 Codex。

## 你需要先准备什么

- VS Code 1.90.0 或更新版本
- 一个已经打开的项目文件夹
- 可用的模型 API Key
- 可选：Roo Code 插件
- 可选：OpenAI Codex VS Code 插件

## 安装插件

从 VSIX 安装：

```text
扩展 -> ... -> Install from VSIX... -> 选择 product-manager-bridge-0.1.0.vsix
```

安装后建议执行一次：

```text
Developer: Reload Window
```

## 第一次配置

1. 打开你的目标项目。
2. 点击左侧 Activity Bar 里的 `Product Manager Bridge` 图标。
3. 在 Architect 区域选择 Provider。
4. 填写 Base URL 和 Model。
5. 点击 `Set Key` 保存 Architect API Key。
6. 用同样方式配置 Validator。
7. 分别点击两个 `Test`，确认连接正常。

DeepSeek 示例：

```text
API Provider: OpenAI Compatible
Base URL: https://api.deepseek.com
Architect Model: deepseek-v4-pro
Validator Model: deepseek-v4-flash
```

API Key 只保存在 VS Code SecretStorage，不会写入项目文件。

## 如何生成计划

1. 在 `Requirement` 输入需求。
2. 如果希望模型重点阅读某些文件，可以写 `@app/main.py` 这样的引用。
3. 点击 `Generate Plan`。
4. 顶部阶段提示会显示当前状态，例如收集上下文、Architect 思考、Validator 检查、需要补充上下文、已批准或已拒绝。
5. 查看 `Plan Result`。

如果 Validator 认为上下文不足，Plan 会要求补充 `required_files` 或说明 `missing_context`。这时把相关文件打开，或在需求里用 `@file` 明确引用后再生成。

## 如何交给 Roo Code

1. 安装 Roo Code。
2. 确保 Plan 已通过 Validator。
3. 点击 `Send to Roo Code`。
4. 确认发送。

如果 Roo Code 命令名变化，可以在设置里修改：

```text
pmBridge.rooCommand
```

默认值：

```text
roo-cline.newTask
```

## 如何交给 Codex

1. 安装 OpenAI Codex VS Code 插件。
2. 确保你已经登录 Codex。
3. 确保 Plan 已通过 Validator。
4. 点击 `Send to Codex`。
5. Product Manager Bridge 会打开 Codex，并把任务复制到剪贴板。
6. 如果 Codex 输入框没有自动出现内容，直接粘贴即可。

默认模式：

```text
pmBridge.codex.delivery = vscode-sidebar
```

实验性一键模式：

```text
pmBridge.codex.delivery = vscode-implement-todo
```

该模式依赖 Codex 插件暴露的 `Implement with Codex` 命令，未来可能会随 Codex 插件变化。

## 常见问题

### 显示 fetch failed 怎么办

新版 Product Manager Bridge 会显示更具体的原因，例如 DNS、证书、代理、超时、HTTP 状态码和响应正文。

优先检查：

- Base URL 是否正确
- API Key 是否正确
- 模型名是否正确
- 网络、代理、VPN 是否可用
- 公司网络是否拦截证书

### 输出里有 hallucinated files 是不是一定失败

Prompt Eval 报告里的 `Hallucinated files: true` 表示测试集中存在用于验证拦截能力的 case，不代表插件当前执行失败。请看具体 case 是否通过。

### Plan 通过后插件会直接改代码吗

不会。Product Manager Bridge 本身只生成、验证、保存和转交计划。真正改代码的是你选择的后续工具，例如 Roo Code 或 Codex，并且仍受它们自己的确认和审批机制约束。

### Plan 需要 revision 怎么办

通常是上下文不足、文件不存在、缺少测试、命令不安全、或违反 Custom Rules。按 Validator 给出的原因补充文件或缩小需求后再生成。
