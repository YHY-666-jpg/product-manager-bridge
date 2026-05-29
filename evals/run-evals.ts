import * as fs from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { OpenAICompatibleProvider } from "../src/llm/OpenAICompatibleProvider";
import { AnthropicCompatibleProvider } from "../src/llm/AnthropicCompatibleProvider";
import { ModelProviderConfig, ModelRole, ProviderFormat } from "../src/llm/types";
import { getArchitectSystemPrompt } from "../src/prompts/architectPrompt";
import { getValidatorSystemPrompt } from "../src/prompts/validatorPrompt";
import { getPlanFilePath, planSchema, Plan } from "../src/schema/planSchema";
import { validationSchema, ValidationResult } from "../src/schema/validationSchema";
import { PolicyValidator } from "../src/security/PolicyValidator";
import { PromptOutputAuditor, AuditProjectContext } from "../src/evals/PromptOutputAuditor";
import { parseJsonObject } from "../src/utils/json";

type EvalMode = "mock" | "live";
type CaseType = "architect" | "validator";

interface EvalCase {
  id: string;
  type: CaseType;
  fixture: string;
  userRequirement: string;
  customRules?: string;
  activeFile?: string;
  visibleFiles?: string[];
  explicitFiles?: string[];
  inputPlan?: unknown;
  expected?: {
    status?: string;
    verdict?: string;
    safe?: boolean;
    noHallucinatedFiles?: boolean;
    noCustomRuleViolations?: boolean;
    requiresTests?: boolean;
    missingTests?: boolean;
    validatorShouldWarnOrRevise?: boolean;
    requiredFilesIncludes?: string[];
    forbiddenFiles?: string[];
  };
}

interface CaseReport {
  id: string;
  type: CaseType;
  passed: boolean;
  failures: string[];
  schemaErrors: string[];
  hallucinatedFiles: string[];
  unsafeCommands: string[];
  dangerousFiles: string[];
  missingTests: boolean;
  customRuleViolations: string[];
  evidenceErrors: string[];
}

interface EvalReport {
  mode: EvalMode;
  totalCases: number;
  passed: number;
  failed: number;
  hasHallucinatedFiles: boolean;
  hasUnsafeCommands: boolean;
  hasSchemaErrors: boolean;
  hasMissingTests: boolean;
  hasCustomRuleViolations: boolean;
  cases: CaseReport[];
}

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const casesDir = path.join(rootDir, "evals", "cases");
const fixturesDir = path.join(rootDir, "evals", "fixtures");
const mockResponsesDir = path.join(rootDir, "evals", "mock-responses");
const reportsDir = path.join(rootDir, "evals", "reports");

async function main(): Promise<void> {
  const mode = process.argv.includes("--live") ? "live" : "mock";
  const cases = await loadCases();
  const caseReports: CaseReport[] = [];
  for (const evalCase of cases) {
    caseReports.push(await runCase(evalCase, mode));
  }
  const report: EvalReport = {
    mode,
    totalCases: caseReports.length,
    passed: caseReports.filter((item) => item.passed).length,
    failed: caseReports.filter((item) => !item.passed).length,
    hasHallucinatedFiles: caseReports.some((item) => item.hallucinatedFiles.length > 0),
    hasUnsafeCommands: caseReports.some((item) => item.unsafeCommands.length > 0),
    hasSchemaErrors: caseReports.some((item) => item.schemaErrors.length > 0),
    hasMissingTests: caseReports.some((item) => item.missingTests),
    hasCustomRuleViolations: caseReports.some((item) => item.customRuleViolations.length > 0),
    cases: caseReports
  };
  await writeReports(report);
  printReport(report);
  if (report.failed > 0) {
    process.exitCode = 1;
  }
}

async function runCase(evalCase: EvalCase, mode: EvalMode): Promise<CaseReport> {
  const context = await buildContext(evalCase);
  const failures: string[] = [];
  const auditor = new PromptOutputAuditor();
  const policy = new PolicyValidator();

  if (evalCase.type === "architect") {
    const output = mode === "mock" ? await readMock(evalCase.id) : await runLiveArchitect(evalCase, context);
    const audit = auditor.auditPlan(output, context, evalCase.customRules ?? "");
    failures.push(...audit.schemaErrors.map((item) => `schema: ${item}`));
    if (evalCase.expected?.noHallucinatedFiles && audit.hallucinatedFiles.length > 0) {
      failures.push(`hallucinated files: ${audit.hallucinatedFiles.join(", ")}`);
    }
    if (audit.unsafeCommands.length > 0) {
      failures.push(`unsafe commands: ${audit.unsafeCommands.join(", ")}`);
    }
    if (audit.dangerousFiles.length > 0) {
      failures.push(`dangerous files: ${audit.dangerousFiles.join(", ")}`);
    }
    if (evalCase.expected?.requiresTests && audit.missingTests) {
      failures.push("missing tests");
    }
    if (evalCase.expected?.noCustomRuleViolations && audit.customRuleViolations.length > 0) {
      failures.push(`custom rule violations: ${audit.customRuleViolations.join(", ")}`);
    }

    const parsed = planSchema.safeParse(output);
    if (parsed.success) {
      checkPlanExpectations(evalCase, parsed.data, failures);
    }

    return {
      id: evalCase.id,
      type: evalCase.type,
      passed: failures.length === 0,
      failures,
      ...audit
    };
  }

  const inputPlan = planSchema.parse(evalCase.inputPlan);
  const output = mode === "mock" ? await readMock(evalCase.id) : await runLiveValidator(evalCase, context, inputPlan);
  const validation = validationSchema.safeParse(output);
  const planAudit = auditor.auditPlan(inputPlan, context, evalCase.customRules ?? "");
  const schemaErrors = validation.success ? [] : validation.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  failures.push(...schemaErrors.map((item) => `schema: ${item}`));
  if (validation.success) {
    checkValidationExpectations(evalCase, validation.data, planAudit, failures);
  }
  const localPolicy = policy.validatePlan(inputPlan, evalCase.customRules ?? "");

  return {
    id: evalCase.id,
    type: evalCase.type,
    passed: failures.length === 0,
    failures,
    schemaErrors,
    hallucinatedFiles: planAudit.hallucinatedFiles,
    unsafeCommands: [...planAudit.unsafeCommands, ...localPolicy.blockingIssues.filter((item) => item.includes("command"))],
    dangerousFiles: [...planAudit.dangerousFiles, ...localPolicy.blockingIssues.filter((item) => item.includes("file path"))],
    missingTests: planAudit.missingTests,
    customRuleViolations: planAudit.customRuleViolations,
    evidenceErrors: planAudit.evidenceErrors
  };
}

function checkPlanExpectations(evalCase: EvalCase, plan: Plan, failures: string[]): void {
  if (evalCase.expected?.status && plan.status !== evalCase.expected.status) {
    failures.push(`expected status ${evalCase.expected.status}, got ${plan.status}`);
  }
  for (const required of evalCase.expected?.requiredFilesIncludes ?? []) {
    if (!plan.required_files.includes(required)) {
      failures.push(`expected required_files to include ${required}`);
    }
  }
  const files = plan.files_to_modify.map(getPlanFilePath);
  for (const forbidden of evalCase.expected?.forbiddenFiles ?? []) {
    if (files.includes(forbidden)) {
      failures.push(`forbidden file proposed: ${forbidden}`);
    }
  }
}

function checkValidationExpectations(evalCase: EvalCase, validation: ValidationResult, audit: ReturnType<PromptOutputAuditor["auditPlan"]>, failures: string[]): void {
  if (evalCase.expected?.verdict && validation.verdict !== evalCase.expected.verdict) {
    failures.push(`expected verdict ${evalCase.expected.verdict}, got ${validation.verdict}`);
  }
  if (typeof evalCase.expected?.safe === "boolean" && validation.safe_to_execute !== evalCase.expected.safe) {
    failures.push(`expected safe_to_execute ${evalCase.expected.safe}, got ${validation.safe_to_execute}`);
  }
  if (evalCase.expected?.missingTests && !audit.missingTests) {
    failures.push("expected missing tests to be detected");
  }
  if (evalCase.expected?.validatorShouldWarnOrRevise) {
    const hasTestWarning = [...validation.warnings, ...validation.blocking_issues].some((item) => /test/i.test(item));
    if (!hasTestWarning && validation.verdict === "approve") {
      failures.push("expected validator warning, revise, or reject for missing tests");
    }
  }
}

async function loadCases(): Promise<EvalCase[]> {
  const files = (await fs.readdir(casesDir)).filter((file) => file.endsWith(".json")).sort();
  return Promise.all(files.map(async (file) => JSON.parse(await fs.readFile(path.join(casesDir, file), "utf8")) as EvalCase));
}

async function readMock(id: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(path.join(mockResponsesDir, `${id}.json`), "utf8"));
}

async function buildContext(evalCase: EvalCase): Promise<AuditProjectContext> {
  const fixtureRoot = path.join(fixturesDir, evalCase.fixture);
  const tree = await listFixtureTree(fixtureRoot);
  return {
    tree,
    activeFile: evalCase.activeFile ? await readFixtureFile(fixtureRoot, evalCase.activeFile) : undefined,
    visibleFiles: await Promise.all((evalCase.visibleFiles ?? []).map((file) => readFixtureFile(fixtureRoot, file))),
    explicitFiles: await Promise.all((evalCase.explicitFiles ?? []).map((file) => readFixtureFile(fixtureRoot, file))),
    requiredFiles: [],
    gitDiff: ""
  };
}

async function listFixtureTree(root: string): Promise<string[]> {
  const entries: string[] = [];
  async function visit(dir: string): Promise<void> {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = path.join(dir, item.name);
      const relative = path.relative(root, full).replace(/\\/g, "/");
      entries.push(item.isDirectory() ? `${relative}/` : relative);
      if (item.isDirectory()) {
        await visit(full);
      }
    }
  }
  await visit(root);
  return entries;
}

async function readFixtureFile(root: string, relativePath: string): Promise<{ path: string; content: string }> {
  return {
    path: relativePath,
    content: await fs.readFile(path.join(root, relativePath), "utf8")
  };
}

async function runLiveArchitect(evalCase: EvalCase, context: AuditProjectContext): Promise<unknown> {
  const response = await makeProvider("architect").generateJson({
    systemPrompt: getArchitectSystemPrompt(evalCase.customRules ?? ""),
    userPrompt: JSON.stringify({ user_requirement: evalCase.userRequirement, project_context: context, custom_rules: evalCase.customRules ?? "" }),
    temperature: Number(process.env.PMBRIDGE_ARCHITECT_TEMPERATURE ?? "0.2"),
    maxTokens: Number(process.env.PMBRIDGE_ARCHITECT_MAX_TOKENS ?? "8192"),
    jsonMode: true
  });
  return unwrap(parseJsonObject(response.text), ["plan", "architect_plan", "result"]);
}

async function runLiveValidator(evalCase: EvalCase, context: AuditProjectContext, plan: Plan): Promise<unknown> {
  const response = await makeProvider("validator").generateJson({
    systemPrompt: getValidatorSystemPrompt(evalCase.customRules ?? ""),
    userPrompt: JSON.stringify({ user_requirement: evalCase.userRequirement, project_context_summary: context, architect_plan: plan, custom_rules: evalCase.customRules ?? "" }),
    temperature: Number(process.env.PMBRIDGE_VALIDATOR_TEMPERATURE ?? "0"),
    maxTokens: Number(process.env.PMBRIDGE_VALIDATOR_MAX_TOKENS ?? "4096"),
    jsonMode: true
  });
  return unwrap(parseJsonObject(response.text), ["validation", "validation_result", "result"]);
}

function makeProvider(role: ModelRole): OpenAICompatibleProvider | AnthropicCompatibleProvider {
  const upper = role.toUpperCase();
  const apiKey = process.env[`PMBRIDGE_${upper}_API_KEY`] ?? process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error(`Live eval requires PMBRIDGE_${upper}_API_KEY or DEEPSEEK_API_KEY.`);
  }
  const format = (process.env[`PMBRIDGE_${upper}_FORMAT`] ?? "openai-compatible") as ProviderFormat;
  const config: ModelProviderConfig = {
    role,
    providerName: process.env[`PMBRIDGE_${upper}_PROVIDER_NAME`] ?? "DeepSeek",
    format,
    baseUrl: process.env[`PMBRIDGE_${upper}_BASE_URL`] ?? "https://api.deepseek.com",
    model: process.env[`PMBRIDGE_${upper}_MODEL`] ?? (role === "architect" ? "deepseek-v4-pro" : "deepseek-v4-flash"),
    temperature: role === "architect" ? 0.2 : 0,
    maxTokens: role === "architect" ? 8192 : 4096,
    jsonMode: true,
    apiKeySecretKey: `env:${role}`,
    requestTimeoutMs: 120000,
    maxRetries: 0
  };
  return format === "anthropic-compatible"
    ? new AnthropicCompatibleProvider(config, apiKey)
    : new OpenAICompatibleProvider(config, apiKey);
}

function unwrap(value: unknown, keys: string[]): unknown {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return value;
  }
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const nested = record[key];
    if (typeof nested === "object" && nested !== null && !Array.isArray(nested)) {
      return nested;
    }
  }
  return value;
}

async function writeReports(report: EvalReport): Promise<void> {
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.writeFile(path.join(reportsDir, "latest.json"), JSON.stringify(report, null, 2), "utf8");
  await fs.writeFile(path.join(reportsDir, "latest.md"), toMarkdown(report), "utf8");
}

function printReport(report: EvalReport): void {
  console.log(toMarkdown(report));
}

function toMarkdown(report: EvalReport): string {
  const lines = [
    `# Prompt Eval Report`,
    ``,
    `Mode: ${report.mode}`,
    `Total cases: ${report.totalCases}`,
    `Passed: ${report.passed}`,
    `Failed: ${report.failed}`,
    ``,
    `Hallucinated files: ${report.hasHallucinatedFiles}`,
    `Unsafe commands: ${report.hasUnsafeCommands}`,
    `Schema errors: ${report.hasSchemaErrors}`,
    `Missing tests: ${report.hasMissingTests}`,
    `Custom rule violations: ${report.hasCustomRuleViolations}`,
    ``
  ];
  for (const item of report.cases) {
    lines.push(`## ${item.passed ? "PASS" : "FAIL"} ${item.id}`);
    if (item.failures.length > 0) {
      lines.push(...item.failures.map((failure) => `- ${failure}`));
    }
    if (item.hallucinatedFiles.length > 0) lines.push(`- hallucinatedFiles: ${item.hallucinatedFiles.join(", ")}`);
    if (item.unsafeCommands.length > 0) lines.push(`- unsafeCommands: ${item.unsafeCommands.join(", ")}`);
    if (item.schemaErrors.length > 0) lines.push(`- schemaErrors: ${item.schemaErrors.join("; ")}`);
    if (item.missingTests) lines.push(`- missingTests: true`);
    if (item.customRuleViolations.length > 0) lines.push(`- customRuleViolations: ${item.customRuleViolations.join("; ")}`);
    if (item.evidenceErrors.length > 0) lines.push(`- evidenceErrors: ${item.evidenceErrors.join("; ")}`);
    lines.push("");
  }
  return lines.join("\n");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
