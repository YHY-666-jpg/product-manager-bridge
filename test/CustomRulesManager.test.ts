import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: (_key: string, fallback: unknown) => fallback,
      update: async () => undefined
    }),
    workspaceFolders: []
  },
  ConfigurationTarget: { Workspace: 1, Global: 2 }
}));

describe("CustomRulesManager", () => {
  it("has default template", async () => {
    const { CustomRulesManager } = await import("../src/customRules/CustomRulesManager");
    expect(new CustomRulesManager().getDefaultTemplate()).toContain("优先保持现有代码风格");
  });
});
