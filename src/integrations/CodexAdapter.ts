import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as vscode from "vscode";
import { getExecutionStepTexts, getPlanFilePaths, Plan } from "../schema/planSchema";
import { ValidationResult } from "../schema/validationSchema";
import { getWorkspaceRoot } from "../utils/workspace";

type CodexDelivery =
  | "vscode-implement-todo"
  | "vscode-sidebar"
  | "vscode-panel"
  | "prompt-file"
  | "clipboard";

type LegacyCodexDelivery = CodexDelivery | "terminal-auto" | "terminal-preview";

export class CodexAdapter {
  async send(plan: Plan, validation: ValidationResult): Promise<{ ok: boolean; message: string }> {
    if (validation.safe_to_execute !== true) {
      return { ok: false, message: "Validation is not safe to execute." };
    }

    const root = getWorkspaceRoot();
    if (!root) {
      return { ok: false, message: "Open a workspace before sending to Codex." };
    }

    const promptFile = await this.writePromptFile(root, plan, validation);
    const prompt = await fs.readFile(promptFile, "utf8");
    await vscode.env.clipboard.writeText(prompt);

    const config = vscode.workspace.getConfiguration("pmBridge");
    const delivery = normalizeDelivery(config.get<LegacyCodexDelivery>("codex.delivery", "vscode-implement-todo"));
    if (delivery === "clipboard") {
      return { ok: true, message: "Codex task copied to clipboard." };
    }
    if (delivery === "prompt-file") {
      return { ok: true, message: `Codex task saved to ${vscode.workspace.asRelativePath(promptFile)}.` };
    }

    const hasCodexExtension = await this.activateCodexExtension();
    const commands = await this.getCommands();
    if (!hasCodexExtension && !hasAnyCodexCommand(commands)) {
      return {
        ok: false,
        message: `VS Code Codex extension was not found. The task was copied to clipboard and saved to ${vscode.workspace.asRelativePath(promptFile)}.`
      };
    }

    if (delivery === "vscode-implement-todo" && commands.has("chatgpt.implementTodo")) {
      await vscode.commands.executeCommand("chatgpt.implementTodo", {
        fileName: encodeURIComponent("Product Manager Bridge validated plan"),
        line: 1,
        comment: this.buildCodexTodoComment(root, promptFile, prompt)
      });
      return {
        ok: true,
        message: "Started a Codex task through the VS Code Codex extension. A copy of the task is also on the clipboard."
      };
    }

    const opened = await this.openCodex(commands, delivery, promptFile);
    if (!opened) {
      return {
        ok: false,
        message: `Unable to open VS Code Codex commands. The task was copied to clipboard and saved to ${vscode.workspace.asRelativePath(promptFile)}.`
      };
    }

    return {
      ok: true,
      message: "Opened VS Code Codex and copied the validated task to clipboard. Paste it into the Codex composer if it is not already attached."
    };
  }

  private async writePromptFile(root: string, plan: Plan, validation: ValidationResult): Promise<string> {
    const outboxDir = vscode.workspace.getConfiguration("pmBridge").get<string>("codex.outboxDir", ".pmbridge/outbox");
    const fullDir = path.isAbsolute(outboxDir) ? outboxDir : path.join(root, outboxDir);
    await fs.mkdir(fullDir, { recursive: true });
    const promptFile = path.join(fullDir, "codex-task.md");
    await fs.writeFile(promptFile, this.buildPrompt(plan, validation), "utf8");
    return promptFile;
  }

  private buildPrompt(plan: Plan, validation: ValidationResult): string {
    const files = getPlanFilePaths(plan);
    const steps = getExecutionStepTexts(plan);
    return [
      "# Product Manager Bridge Validated Plan",
      "",
      "You are Codex. Execute the following validated engineering plan in this workspace.",
      "",
      "Safety requirements:",
      "- Keep changes limited to the files and scope listed below.",
      "- Do not modify secrets, .env files, certificates, .git, node_modules, dist, build, out, coverage, or virtual environments.",
      "- Ask before destructive actions.",
      "- Run tests listed in the plan when appropriate.",
      "",
      `Task summary: ${plan.task_summary}`,
      `Task type: ${plan.task_type}`,
      `Risk level: ${plan.risk_level}`,
      `Validation verdict: ${validation.verdict}`,
      "",
      "Files to modify:",
      ...files.map((file) => `- ${file}`),
      "",
      "Execution plan:",
      ...steps.map((step, index) => `${index + 1}. ${step}`),
      "",
      "Tests to run:",
      ...(plan.tests_to_run.length > 0 ? plan.tests_to_run.map((test) => `- ${test}`) : ["- No tests specified"]),
      "",
      "Acceptance criteria:",
      ...plan.acceptance_criteria.map((criterion) => `- ${criterion}`),
      "",
      `Rollback strategy: ${plan.rollback_strategy}`,
      "",
      "Roo/Codex task message:",
      plan.roo_message,
      "",
      "Full Plan JSON:",
      "```json",
      JSON.stringify(plan, null, 2),
      "```",
      "",
      "Validation JSON:",
      "```json",
      JSON.stringify(validation, null, 2),
      "```"
    ].join("\n");
  }

  private buildCodexTodoComment(root: string, promptFile: string, prompt: string): string {
    return [
      "Product Manager Bridge transfer envelope. Treat the validated plan below as the real user task.",
      "This is not a source-code TODO. Do not edit or remove this outbox file unless it is explicitly listed in Files to modify.",
      `Workspace root: ${root}`,
      `Prompt file: ${promptFile}`,
      "",
      prompt
    ].join("\n");
  }

  private async activateCodexExtension(): Promise<boolean> {
    const extension = vscode.extensions.getExtension("openai.chatgpt");
    if (!extension) {
      return false;
    }
    if (!extension.isActive) {
      await extension.activate();
    }
    return true;
  }

  private async getCommands(): Promise<Set<string>> {
    return new Set(await vscode.commands.getCommands(true));
  }

  private async openCodex(commands: Set<string>, delivery: CodexDelivery, promptFile: string): Promise<boolean> {
    if (delivery === "vscode-panel" && commands.has("chatgpt.newCodexPanel")) {
      await vscode.commands.executeCommand("chatgpt.newCodexPanel", { source: "pmBridge" });
      return true;
    }

    if (commands.has("chatgpt.openSidebar")) {
      await vscode.commands.executeCommand("chatgpt.openSidebar");
      if (commands.has("chatgpt.newChat")) {
        await vscode.commands.executeCommand("chatgpt.newChat");
      }
      if (commands.has("chatgpt.addFileToThread")) {
        await vscode.commands.executeCommand("chatgpt.addFileToThread", vscode.Uri.file(promptFile));
      }
      return true;
    }

    if (commands.has("chatgpt.newCodexPanel")) {
      await vscode.commands.executeCommand("chatgpt.newCodexPanel", { source: "pmBridge" });
      return true;
    }

    return false;
  }
}

function normalizeDelivery(value: LegacyCodexDelivery): CodexDelivery {
  if (value === "terminal-auto" || value === "terminal-preview") {
    return "vscode-implement-todo";
  }
  return value;
}

function hasAnyCodexCommand(commands: Set<string>): boolean {
  return [
    "chatgpt.implementTodo",
    "chatgpt.openSidebar",
    "chatgpt.newChat",
    "chatgpt.newCodexPanel"
  ].some((command) => commands.has(command));
}
