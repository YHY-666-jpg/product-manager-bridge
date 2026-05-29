import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      vscode: resolve(__dirname, "test/mocks/vscode.ts")
    }
  },
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.test.ts"]
  }
});
