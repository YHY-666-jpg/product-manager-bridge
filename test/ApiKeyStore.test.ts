import { describe, expect, it } from "vitest";
import { ApiKeyStore } from "../src/llm/ApiKeyStore";

describe("ApiKeyStore", () => {
  it("stores roles separately", async () => {
    const data = new Map<string, string>();
    const store = new ApiKeyStore({
      get: async (key: string) => data.get(key),
      store: async (key: string, value: string) => { data.set(key, value); },
      delete: async (key: string) => { data.delete(key); },
      onDidChange: (() => ({ dispose: () => undefined })) as never
    });
    await store.setApiKey("architect", "a");
    await store.setApiKey("validator", "v");
    expect(await store.getApiKey("architect")).toBe("a");
    expect(await store.hasApiKey("validator")).toBe(true);
    await store.clearApiKey("validator");
    expect(await store.hasApiKey("validator")).toBe(false);
  });
});
