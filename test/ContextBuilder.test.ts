import { describe, expect, it } from "vitest";
import { extractFileRefs } from "../src/context/fileResolver";

describe("ContextBuilder helpers", () => {
  it("parses file refs", () => {
    expect(extractFileRefs("fix @src/a.ts and @src/a.ts")).toEqual(["src/a.ts"]);
  });

  it("does not parse parent traversal as a normal ref", () => {
    expect(extractFileRefs("read @../secret.env")).toEqual([]);
  });
});
