import { describe, expect, it, vi } from "vitest";

vi.mock("vscode", () => ({
  workspace: {
    getConfiguration: () => ({
      get: (key: string, fallback: unknown) => key === "architect.baseUrl" ? "https://api.example.com" : fallback
    })
  }
}));

describe("ProviderConfigReader", () => {
  it("reads architect config", async () => {
    const { ProviderConfigReader } = await import("../src/llm/ProviderConfigReader");
    expect(new ProviderConfigReader().read("architect").baseUrl).toBe("https://api.example.com");
  });
});
