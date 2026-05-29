export type { Plan } from "./planSchema";
export type { ValidationResult } from "./validationSchema";

export interface PolicyFindings {
  blockingIssues: string[];
  warnings: string[];
}
