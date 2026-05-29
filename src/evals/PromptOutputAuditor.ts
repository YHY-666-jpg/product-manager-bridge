import * as path from "node:path";
import { z } from "zod";
import {
  Evidence,
  ExecutionStep,
  getExecutionStepText,
  getPlanFilePath,
  Plan,
  planSchema
} from "../schema/planSchema";
import { PolicyValidator } from "../security/PolicyValidator";

export interface AuditContextFile {
  path: string;
  content?: string;
}

export interface AuditProjectContext {
  tree: string[];
  activeFile?: AuditContextFile;
  visibleFiles: AuditContextFile[];
  explicitFiles: AuditContextFile[];
  requiredFiles?: AuditContextFile[];
  gitDiff?: string;
}

export interface PromptAuditResult {
  passed: boolean;
  schemaErrors: string[];
  hallucinatedFiles: string[];
  unsafeCommands: string[];
  dangerousFiles: string[];
  missingTests: boolean;
  customRuleViolations: string[];
  evidenceErrors: string[];
  warnings: string[];
}

const fileRefPattern = /(?:@)?([A-Za-z0-9_.\-\/\\]+\.[A-Za-z0-9]+)/g;

export class PromptOutputAuditor {
  private readonly policy = new PolicyValidator();

  auditPlan(candidate: unknown, context: AuditProjectContext, customRules = ""): PromptAuditResult {
    const schema = planSchema.safeParse(candidate);
    if (!schema.success) {
      return this.withPassed({
        schemaErrors: formatZodErrors(schema.error),
        hallucinatedFiles: [],
        unsafeCommands: [],
        dangerousFiles: [],
        missingTests: false,
        customRuleViolations: [],
        evidenceErrors: [],
        warnings: []
      });
    }

    const plan = schema.data;
    const knownFiles = this.collectKnownFiles(context, plan.required_files);
    const filesToModify = plan.files_to_modify.map(getPlanFilePath);
    const executionRefs = this.extractExecutionFileRefs(plan.execution_plan);
    const hallucinatedFiles = [...new Set([...filesToModify, ...executionRefs].filter((file) => !knownFiles.has(normalizePath(file))))];
    const policy = this.policy.validatePlan(plan, customRules);
    const dangerousFiles = filesToModify.filter((file) => this.policy.isDangerousPath(file));
    const commandText = [...plan.execution_plan.map(getExecutionStepText), ...plan.tests_to_run, plan.roo_message].join("\n");
    const unsafeCommands = this.policy.isDangerousCommand(commandText) ? ["Plan contains dangerous command text."] : [];
    const missingTests = ["feature", "bugfix", "refactor"].includes(plan.task_type) && plan.tests_to_run.length === 0;
    const evidenceErrors = this.auditEvidence(plan, context);
    const customRuleViolations = this.auditCustomRules(plan, customRules);

    return this.withPassed({
      schemaErrors: [],
      hallucinatedFiles,
      unsafeCommands: [...unsafeCommands, ...policy.blockingIssues.filter((issue) => issue.includes("command"))],
      dangerousFiles: [...new Set([...dangerousFiles, ...policy.blockingIssues.filter((issue) => issue.includes("file path"))])],
      missingTests,
      customRuleViolations,
      evidenceErrors,
      warnings: policy.warnings
    });
  }

  private withPassed(result: Omit<PromptAuditResult, "passed">): PromptAuditResult {
    return {
      ...result,
      passed:
        result.schemaErrors.length === 0 &&
        result.hallucinatedFiles.length === 0 &&
        result.unsafeCommands.length === 0 &&
        result.dangerousFiles.length === 0 &&
        !result.missingTests &&
        result.customRuleViolations.length === 0 &&
        result.evidenceErrors.length === 0
    };
  }

  private collectKnownFiles(context: AuditProjectContext, requiredFiles: string[]): Set<string> {
    const known = new Set<string>();
    for (const entry of context.tree) {
      const normalized = normalizeTreeEntry(entry);
      if (normalized && !normalized.endsWith("/")) {
        known.add(normalized);
      }
    }
    for (const file of [
      context.activeFile,
      ...context.visibleFiles,
      ...context.explicitFiles,
      ...(context.requiredFiles ?? [])
    ].filter(Boolean) as AuditContextFile[]) {
      known.add(normalizePath(file.path));
    }
    for (const file of requiredFiles) {
      known.add(normalizePath(file));
    }
    return known;
  }

  private extractExecutionFileRefs(steps: ExecutionStep[]): string[] {
    const refs: string[] = [];
    for (const step of steps) {
      const text = getExecutionStepText(step);
      for (const match of text.matchAll(fileRefPattern)) {
        refs.push(match[1].replace(/\\/g, "/"));
      }
    }
    return refs;
  }

  private auditEvidence(plan: Plan, context: AuditProjectContext): string[] {
    const errors: string[] = [];
    const entries: Array<{ owner: string; evidence: Evidence[] }> = [];
    for (const file of plan.files_to_modify) {
      if (typeof file !== "string" && file.evidence) {
        entries.push({ owner: file.path, evidence: file.evidence });
      }
    }
    for (const step of plan.execution_plan) {
      if (typeof step !== "string" && step.evidence) {
        entries.push({ owner: step.step, evidence: step.evidence });
      }
    }

    for (const entry of entries) {
      for (const evidence of entry.evidence) {
        const haystack = this.getEvidenceHaystack(evidence, context);
        if (!haystack) {
          errors.push(`${entry.owner}: no context content found for evidence ${evidence.source}:${evidence.path}`);
          continue;
        }
        if (!haystack.includes(evidence.quote)) {
          errors.push(`${entry.owner}: evidence quote not found in ${evidence.source}:${evidence.path}`);
        }
      }
    }
    return errors;
  }

  private getEvidenceHaystack(evidence: Evidence, context: AuditProjectContext): string {
    if (evidence.source === "tree") {
      return context.tree.join("\n");
    }
    if (evidence.source === "git_diff") {
      return context.gitDiff ?? "";
    }
    const normalized = normalizePath(evidence.path);
    const candidates =
      evidence.source === "active_file"
        ? [context.activeFile].filter(Boolean) as AuditContextFile[]
        : evidence.source === "visible_files"
          ? context.visibleFiles
          : evidence.source === "explicit_files"
            ? context.explicitFiles
            : context.requiredFiles ?? [];
    return candidates.find((file) => normalizePath(file.path) === normalized)?.content ?? "";
  }

  private auditCustomRules(plan: Plan, customRules: string): string[] {
    const violations: string[] = [];
    if (!customRules) {
      return violations;
    }
    const normalizedRules = customRules.toLowerCase();
    const text = JSON.stringify(plan).toLowerCase();
    const modifiesPackageJson = plan.files_to_modify.some((file) => path.basename(getPlanFilePath(file)).toLowerCase() === "package.json");
    if (
      (normalizedRules.includes("no new dependencies") || normalizedRules.includes("do not add dependencies") || customRules.includes("不新增第三方依赖")) &&
      (modifiesPackageJson || /\bnpm install\b|\bpnpm add\b|\byarn add\b|\badd (?:a |new )?dependenc(?:y|ies)\b/.test(text))
    ) {
      violations.push("Custom rule forbids new dependencies, but plan appears to add or edit dependencies.");
    }
    return violations;
  }
}

function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`);
}

function normalizeTreeEntry(entry: string): string {
  return normalizePath(entry.trim().replace(/^\s+/, ""));
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}
