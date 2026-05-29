import { z } from "zod";

export const evidenceSchema = z.object({
  source: z.enum(["tree", "active_file", "visible_files", "explicit_files", "git_diff", "required_file"]),
  path: z.string(),
  quote: z.string(),
  confidence: z.number().min(0).max(1)
});

export const planFileSchema = z.union([
  z.string(),
  z.object({
    path: z.string(),
    evidence: z.array(evidenceSchema).optional()
  })
]);

export const executionStepSchema = z.union([
  z.string(),
  z.object({
    step: z.string(),
    evidence: z.array(evidenceSchema).optional()
  })
]);

export const planSchema = z.object({
  status: z.string(),
  task_summary: z.string(),
  task_type: z.enum(["feature", "bugfix", "refactor", "docs", "test", "chore", "unknown"]),
  confidence: z.number().min(0).max(1),
  risk_level: z.enum(["low", "medium", "high"]),
  files_to_modify: z.array(planFileSchema),
  execution_plan: z.array(executionStepSchema),
  tests_to_run: z.array(z.string()),
  acceptance_criteria: z.array(z.string()),
  rollback_strategy: z.string(),
  missing_context: z.array(z.string()).default([]),
  required_files: z.array(z.string()).default([]),
  user_rules_applied: z.boolean().default(false),
  user_rules_notes: z.array(z.string()).default([]),
  roo_message: z.string().default("")
});

export type Evidence = z.infer<typeof evidenceSchema>;
export type PlanFile = z.infer<typeof planFileSchema>;
export type ExecutionStep = z.infer<typeof executionStepSchema>;
export type Plan = z.infer<typeof planSchema>;

export function getPlanFilePath(file: PlanFile): string {
  return typeof file === "string" ? file : file.path;
}

export function getExecutionStepText(step: ExecutionStep): string {
  return typeof step === "string" ? step : step.step;
}

export function getPlanFilePaths(plan: Plan): string[] {
  return plan.files_to_modify.map(getPlanFilePath);
}

export function getExecutionStepTexts(plan: Plan): string[] {
  return plan.execution_plan.map(getExecutionStepText);
}
