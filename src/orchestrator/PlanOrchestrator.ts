import * as vscode from "vscode";
import { z } from "zod";
import { ContextBuilder } from "../context/ContextBuilder";
import { CustomRulesManager } from "../customRules/CustomRulesManager";
import { ModelRouter } from "../llm/ModelRouter";
import { ProviderConfigReader } from "../llm/ProviderConfigReader";
import { getArchitectSystemPrompt } from "../prompts/architectPrompt";
import { getValidatorSystemPrompt } from "../prompts/validatorPrompt";
import { planSchema, Plan } from "../schema/planSchema";
import { PolicyFindings } from "../schema/types";
import { validationSchema, ValidationResult } from "../schema/validationSchema";
import { PolicyValidator } from "../security/PolicyValidator";
import { parseJsonObject } from "../utils/json";

export interface OrchestrationResult {
  plan: Plan | null;
  validation: ValidationResult | null;
  contextSummary: object;
  policyFindings: PolicyFindings;
  loopsUsed: number;
  status: "approved" | "rejected" | "needs_revision" | "error";
  userFacingMessage: string;
}

export interface OrchestrationProgress {
  phase:
    | "preparing"
    | "collecting_context"
    | "context_ready"
    | "architect_thinking"
    | "architect_parsing"
    | "policy_checking"
    | "validator_checking"
    | "validator_parsing"
    | "reading_required_files"
    | "approved"
    | "rejected"
    | "needs_revision";
  title: string;
  message: string;
  loop?: number;
}

export interface OrchestrationOptions {
  onProgress?: (progress: OrchestrationProgress) => void | Promise<void>;
}

export class PlanOrchestrator {
  private readonly contextBuilder = new ContextBuilder();
  private readonly rules = new CustomRulesManager();
  private readonly policy = new PolicyValidator();
  private readonly configReader = new ProviderConfigReader();

  constructor(private readonly modelRouter: ModelRouter) {}

  async generateValidatedPlan(userRequirement: string, options: OrchestrationOptions = {}): Promise<OrchestrationResult> {
    const progress = async (event: OrchestrationProgress): Promise<void> => {
      await options.onProgress?.(event);
    };

    await progress({
      phase: "preparing",
      title: "Preparing",
      message: "Reading custom rules and model settings."
    });
    const customRulesState = await this.rules.readRules();
    const customRules = customRulesState.enabled ? customRulesState.text : "";
    const maxLoops = vscode.workspace.getConfiguration("pmBridge").get<number>("safety.maxPlannerLoops", 2);
    let loopsUsed = 0;
    let extraFiles: string[] = [];
    let lastPlan: Plan | null = null;
    let lastValidation: ValidationResult | null = null;
    let lastContextSummary: object = {};
    let lastPolicy: PolicyFindings = { blockingIssues: [], warnings: [] };

    while (loopsUsed <= maxLoops) {
      await progress({
        phase: "collecting_context",
        title: "Collecting Context",
        message: "Reading workspace tree, referenced files, visible editors, git status, and git diff.",
        loop: loopsUsed
      });
      const context = await this.contextBuilder.build(userRequirement, extraFiles);
      lastContextSummary = this.contextBuilder.summarize(context);
      await progress({
        phase: "context_ready",
        title: "Context Ready",
        message: "Project context is ready. Sending it to Architect.",
        loop: loopsUsed
      });

      const architectConfig = this.configReader.read("architect");
      await progress({
        phase: "architect_thinking",
        title: "Architect Thinking",
        message: "Architect model is creating a grounded execution plan.",
        loop: loopsUsed
      });
      const architectRaw = await this.modelRouter.generate("architect", {
        systemPrompt: getArchitectSystemPrompt(customRules),
        userPrompt: JSON.stringify({
          user_requirement: userRequirement,
          project_context: context,
          custom_rules: customRules,
          constraints: ["MVP never edits code automatically", "MVP never runs shell commands automatically"]
        }),
        temperature: architectConfig.temperature,
        maxTokens: architectConfig.maxTokens,
        jsonMode: architectConfig.jsonMode
      });

      await progress({
        phase: "architect_parsing",
        title: "Parsing Architect Plan",
        message: "Checking Architect JSON against the Plan schema.",
        loop: loopsUsed
      });
      const planCandidate = unwrapCandidate(parseJsonObject(architectRaw.text), ["plan", "architect_plan", "result"]);
      const planParse = planSchema.safeParse(planCandidate);
      if (!planParse.success) {
        throw new Error(buildSchemaError("Architect", "Plan", planParse.error, architectRaw.text));
      }
      lastPlan = planParse.data;

      await progress({
        phase: "policy_checking",
        title: "Local Policy Check",
        message: "Checking for dangerous files, unsafe commands, missing tests, and local policy violations.",
        loop: loopsUsed
      });
      lastPolicy = this.policy.validatePlan(lastPlan, customRules);

      const validatorConfig = this.configReader.read("validator");
      await progress({
        phase: "validator_checking",
        title: "Validator Checking",
        message: "Validator model is reviewing safety, completeness, evidence, and custom rules.",
        loop: loopsUsed
      });
      const validatorRaw = await this.modelRouter.generate("validator", {
        systemPrompt: getValidatorSystemPrompt(customRules),
        userPrompt: JSON.stringify({
          user_requirement: userRequirement,
          project_context_summary: lastContextSummary,
          architect_plan: lastPlan,
          local_policy_findings: lastPolicy,
          custom_rules: customRules
        }),
        temperature: validatorConfig.temperature,
        maxTokens: validatorConfig.maxTokens,
        jsonMode: validatorConfig.jsonMode
      });

      await progress({
        phase: "validator_parsing",
        title: "Parsing Validation",
        message: "Checking Validator JSON against the ValidationResult schema.",
        loop: loopsUsed
      });
      const validationCandidate = unwrapCandidate(parseJsonObject(validatorRaw.text), ["validation", "validation_result", "result"]);
      const validationParse = validationSchema.safeParse(validationCandidate);
      if (!validationParse.success) {
        throw new Error(buildSchemaError("Validator", "ValidationResult", validationParse.error, validatorRaw.text));
      }
      lastValidation = validationParse.data;

      if (lastPolicy.blockingIssues.length > 0) {
        lastValidation = {
          ...lastValidation,
          verdict: "reject",
          safe_to_execute: false,
          blocking_issues: [...lastValidation.blocking_issues, ...lastPolicy.blockingIssues]
        };
      }

      if (lastValidation.verdict === "approve") {
        await progress({
          phase: "approved",
          title: "Approved",
          message: "Validator approved the plan.",
          loop: loopsUsed
        });
        return {
          plan: lastPlan,
          validation: lastValidation,
          contextSummary: lastContextSummary,
          policyFindings: lastPolicy,
          loopsUsed,
          status: "approved",
          userFacingMessage: "Plan approved."
        };
      }

      const required = [...new Set([...lastValidation.required_files, ...lastPlan.required_files])];
      if (lastValidation.verdict === "revise" && required.length > 0 && loopsUsed < maxLoops) {
        await progress({
          phase: "reading_required_files",
          title: "Reading Required Files",
          message: `Validator requested more context: ${required.join(", ")}`,
          loop: loopsUsed
        });
        extraFiles = required;
        loopsUsed += 1;
        continue;
      }

      await progress({
        phase: lastValidation.verdict === "reject" ? "rejected" : "needs_revision",
        title: lastValidation.verdict === "reject" ? "Rejected" : "Needs Revision",
        message: lastValidation.final_recommendation,
        loop: loopsUsed
      });
      return {
        plan: lastPlan,
        validation: lastValidation,
        contextSummary: lastContextSummary,
        policyFindings: lastPolicy,
        loopsUsed,
        status: lastValidation.verdict === "reject" ? "rejected" : "needs_revision",
        userFacingMessage: lastValidation.final_recommendation
      };
    }

    return {
      plan: lastPlan,
      validation: lastValidation,
      contextSummary: lastContextSummary,
      policyFindings: lastPolicy,
      loopsUsed,
      status: "needs_revision",
      userFacingMessage: "Planner loop limit reached."
    };
  }
}

function unwrapCandidate(value: unknown, wrapperKeys: string[]): unknown {
  if (!isRecord(value)) {
    return value;
  }
  for (const key of wrapperKeys) {
    const nested = value[key];
    if (isRecord(nested)) {
      return nested;
    }
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildSchemaError(source: string, schemaName: string, error: z.ZodError, rawText: string): string {
  const issueText = error.issues
    .slice(0, 10)
    .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
    .join("; ");
  return `${source} returned JSON, but it did not match ${schemaName}. Missing or invalid fields: ${issueText}. Raw model response preview: ${clip(rawText)}`;
}

function clip(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 1200 ? `${compact.slice(0, 1200)}...` : compact;
}
