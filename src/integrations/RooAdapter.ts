import * as vscode from "vscode";
import { getExecutionStepTexts, Plan } from "../schema/planSchema";
import { ValidationResult } from "../schema/validationSchema";

export class RooAdapter {
  async send(plan: Plan, validation: ValidationResult): Promise<{ ok: boolean; message: string }> {
    if (validation.safe_to_execute !== true) {
      return { ok: false, message: "Validation is not safe to execute." };
    }

    const configuredCommand = vscode.workspace.getConfiguration("pmBridge").get<string>("rooCommand", "roo-cline.newTask");
    const payload = plan.roo_message || getExecutionStepTexts(plan).join("\n");
    const attempts = this.buildAttempts(configuredCommand, payload);
    const errors: string[] = [];

    for (const attempt of attempts) {
      try {
        await vscode.commands.executeCommand(attempt.command, attempt.argument);
        return { ok: true, message: `Sent to Roo Code through ${attempt.command}.` };
      } catch (error) {
        errors.push(`${attempt.command}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    await vscode.env.clipboard.writeText(payload);
    return {
      ok: false,
      message: `Unable to call Roo Code. The plan was copied to clipboard. Tried: ${errors.join(" | ")}`
    };
  }

  private buildAttempts(configuredCommand: string, payload: string): Array<{ command: string; argument: unknown }> {
    const attempts: Array<{ command: string; argument: unknown }> = [];
    const add = (command: string, argument: unknown): void => {
      const key = `${command}:${JSON.stringify(argument)}`;
      if (!attempts.some((attempt) => `${attempt.command}:${JSON.stringify(attempt.argument)}` === key)) {
        attempts.push({ command, argument });
      }
    };

    if (configuredCommand === "roo-cline.newTask") {
      add(configuredCommand, { prompt: payload });
    } else if (configuredCommand === "roo-cline.sendMessage") {
      add(configuredCommand, { text: payload });
    } else {
      add(configuredCommand, { prompt: payload });
      add(configuredCommand, { text: payload });
      add(configuredCommand, payload);
    }

    add("roo-cline.newTask", { prompt: payload });
    return attempts;
  }
}
