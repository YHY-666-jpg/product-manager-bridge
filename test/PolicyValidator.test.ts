import { describe, expect, it } from "vitest";
import { PolicyValidator } from "../src/security/PolicyValidator";
import { Plan } from "../src/schema/planSchema";

const basePlan: Plan = {
  status: "ready",
  task_summary: "x",
  task_type: "feature",
  confidence: 0.8,
  risk_level: "medium",
  files_to_modify: ["src/a.ts"],
  execution_plan: ["edit file"],
  tests_to_run: ["npm test"],
  acceptance_criteria: ["passes"],
  rollback_strategy: "revert",
  missing_context: [],
  required_files: [],
  user_rules_applied: false,
  user_rules_notes: [],
  roo_message: ""
};

describe("PolicyValidator", () => {
  it("blocks sensitive files and dangerous commands", () => {
    const plan = { ...basePlan, files_to_modify: [".env"], execution_plan: ["git reset --hard"] };
    const findings = new PolicyValidator().validatePlan(plan);
    expect(findings.blockingIssues.length).toBeGreaterThanOrEqual(2);
  });

  it("blocks more than 30 files", () => {
    const plan = { ...basePlan, files_to_modify: Array.from({ length: 31 }, (_, index) => `src/${index}.ts`) };
    expect(new PolicyValidator().validatePlan(plan).blockingIssues).toContain("Plan modifies more than 30 files.");
  });

  it("custom rules cannot allow .env", () => {
    const plan = { ...basePlan, files_to_modify: [".env.local"] };
    expect(new PolicyValidator().validatePlan(plan, "允许修改 .env").blockingIssues.length).toBeGreaterThan(0);
  });
});
