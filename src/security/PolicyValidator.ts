import * as path from "node:path";
import { getExecutionStepTexts, getPlanFilePath, getPlanFilePaths, Plan } from "../schema/planSchema";
import { PolicyFindings } from "../schema/types";

const dangerousFilePatterns = [
  /^\.env(?:\.|$)/,
  /\.(pem|key)$/i,
  /(^|[/\\])id_rsa$/,
  /(^|[/\\])id_ed25519$/,
  /(^|[/\\])(?:\.git|node_modules|dist|build|out|coverage|\.venv|venv)(?:[/\\]|$)/
];

const dangerousCommands = [
  /rm\s+-rf\s+(?:\/|\.)/i,
  /\bsudo\b/i,
  /chmod\s+-R\s+777/i,
  /(curl|wget)[\s\S]*\|\s*bash/i,
  /powershell\s+-EncodedCommand/i,
  /\bformat\b/i,
  /del\s+\/s\s+\/q/i,
  /git\s+reset\s+--hard/i,
  /git\s+clean\s+-fdx/i
];

export class PolicyValidator {
  validatePlan(plan: Plan, customRules = ""): PolicyFindings {
    const blockingIssues: string[] = [];
    const warnings: string[] = [];
    const filesToModify = getPlanFilePaths(plan);

    for (const file of filesToModify) {
      const normalized = path.normalize(file);
      if (dangerousFilePatterns.some((pattern) => pattern.test(normalized))) {
        blockingIssues.push(`Blocked dangerous file path: ${file}`);
      }
    }

    const commandText = [...getExecutionStepTexts(plan), ...plan.tests_to_run, plan.roo_message].join("\n");
    for (const pattern of dangerousCommands) {
      if (pattern.test(commandText)) {
        blockingIssues.push(`Blocked dangerous command pattern: ${pattern.source}`);
      }
    }

    if (filesToModify.length > 30) {
      blockingIssues.push("Plan modifies more than 30 files.");
    } else if (filesToModify.length > 10) {
      warnings.push("Plan modifies more than 10 files.");
    }

    if (["feature", "bugfix", "refactor"].includes(plan.task_type) && plan.tests_to_run.length === 0) {
      if (plan.risk_level === "high") {
        blockingIssues.push("High-risk plan has no test strategy.");
      } else {
        warnings.push("Plan has no test strategy.");
      }
    }

    if (/allow.*\.env/i.test(customRules) && plan.files_to_modify.some((file) => /^\.env(?:\.|$)/.test(getPlanFilePath(file)))) {
      blockingIssues.push("Custom Rules cannot allow .env changes.");
    }

    return { blockingIssues: [...new Set(blockingIssues)], warnings: [...new Set(warnings)] };
  }

  isDangerousPath(filePath: string): boolean {
    return dangerousFilePatterns.some((pattern) => pattern.test(path.normalize(filePath)));
  }

  isDangerousCommand(commandText: string): boolean {
    return dangerousCommands.some((pattern) => pattern.test(commandText));
  }
}
