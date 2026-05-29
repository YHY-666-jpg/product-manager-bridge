import { describe, expect, it } from "vitest";
import { SecretScanner } from "../src/security/SecretScanner";

describe("SecretScanner", () => {
  it("redacts supported secrets", () => {
    const input = [
      "Authorization: Bearer abcdefghijklmnopqrstuvwxyz123456",
      "-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----",
      "postgres://user:pass@localhost/db",
      "ghp_abcdefghijklmnopqrstuvwxyz1234567890"
    ].join("\n");
    const result = new SecretScanner().scanAndRedact(input);
    expect(result.text).not.toContain("abcdefghijklmnopqrstuvwxyz123456");
    expect(result.text).not.toContain("user:pass");
    expect(result.hitCount).toBeGreaterThan(0);
  });
});
