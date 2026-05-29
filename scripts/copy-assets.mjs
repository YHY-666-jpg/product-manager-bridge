import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";

const files = [
  ["src/webview/styles.css", "dist/webview/styles.css"]
];

for (const [from, to] of files) {
  if (existsSync(from)) {
    mkdirSync(dirname(to), { recursive: true });
    copyFileSync(from, to);
  }
}
