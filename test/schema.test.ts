import { describe, expect, it } from "vitest";
import { planSchema } from "../src/schema/planSchema";
import { validationSchema } from "../src/schema/validationSchema";

describe("schemas", () => {
  it("validates Plan and rejects missing fields", () => {
    const plan = {
      status: "ready",
      task_summary: "summary",
      task_type: "bugfix",
      confidence: 0.9,
      risk_level: "low",
      files_to_modify: [],
      execution_plan: [],
      tests_to_run: [],
      acceptance_criteria: [],
      rollback_strategy: "revert"
    };
    expect(planSchema.parse(plan).required_files).toEqual([]);
    expect(() => planSchema.parse({ status: "x" })).toThrow();
  });

  it("validates ValidationResult and rejects bad verdict", () => {
    expect(validationSchema.parse({ verdict: "approve", safe_to_execute: true, final_recommendation: "ok" }).warnings).toEqual([]);
    expect(() => validationSchema.parse({ verdict: "maybe", safe_to_execute: true, final_recommendation: "x" })).toThrow();
  });
});
