import * as vscode from "vscode";

export interface CustomRulesState {
  enabled: boolean;
  text: string;
  maxChars: number;
}

export class CustomRulesManager {
  async readRules(): Promise<CustomRulesState> {
    const config = vscode.workspace.getConfiguration("pmBridge");
    return {
      enabled: config.get<boolean>("customRules.enabled", true),
      text: config.get<string>("customRules.text", ""),
      maxChars: config.get<number>("customRules.maxChars", 8000)
    };
  }

  async saveRules(text: string, enabled: boolean): Promise<void> {
    const current = await this.readRules();
    const trimmed = text.trim();
    if (trimmed.length > current.maxChars) {
      throw new Error(`Custom Rules exceeds ${current.maxChars} characters.`);
    }
    const target = vscode.workspace.workspaceFolders?.length ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global;
    const config = vscode.workspace.getConfiguration("pmBridge");
    await config.update("customRules.text", trimmed, target);
    await config.update("customRules.enabled", enabled, target);
  }

  async resetRules(): Promise<void> {
    await this.saveRules("", true);
  }

  getDefaultTemplate(): string {
    return [
      "请遵守以下工程约束：",
      "1. 优先保持现有代码风格和项目结构。",
      "2. 不要进行与需求无关的大规模重构。",
      "3. 不要修改敏感文件，例如 .env、密钥、证书、私钥。",
      "4. 不要新增第三方依赖，除非明确说明必要性和替代方案。",
      "5. feature、bugfix、refactor 类型任务必须给出测试策略。",
      "6. 涉及并发、缓存、文件 I/O、数据库、网络请求时，必须说明风险和回滚方式。",
      "7. 优先做最小可行变更。",
      "8. 输出给 Roo Code 的任务说明必须清晰、分步骤、可执行。",
      "9. 如果上下文不足，不要猜测，必须请求补充文件。",
      "10. 所有说明优先使用中文。"
    ].join("\n");
  }
}
