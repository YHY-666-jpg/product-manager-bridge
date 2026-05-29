import { z } from "zod";

export const validationSchema = z.object({
  verdict: z.enum(["approve", "revise", "reject"]),
  safe_to_execute: z.boolean(),
  blocking_issues: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
  required_files: z.array(z.string()).default([]),
  final_recommendation: z.string(),
  custom_rules_check: z.object({
    violations: z.array(z.string()).default([])
  }).default({ violations: [] })
});

export type ValidationResult = z.infer<typeof validationSchema>;
