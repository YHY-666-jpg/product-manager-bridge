import * as fs from "node:fs/promises";
import * as path from "node:path";

const ignored = new Set(["node_modules", ".git", "dist", "build", "out", "coverage", ".venv", "venv"]);

export async function buildTree(root: string, maxDepth: number, maxEntries: number): Promise<string[]> {
  const lines: string[] = [];
  async function visit(dir: string, depth: number): Promise<void> {
    if (depth > maxDepth || lines.length >= maxEntries) {
      return;
    }
    let entries: Array<{ name: string; isDirectory(): boolean }>;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      if (lines.length >= maxEntries || ignored.has(entry.name)) {
        continue;
      }
      const full = path.join(dir, entry.name);
      const relative = path.relative(root, full).replace(/\\/g, "/");
      lines.push(`${"  ".repeat(depth)}${entry.isDirectory() ? relative + "/" : relative}`);
      if (entry.isDirectory()) {
        await visit(full, depth + 1);
      }
    }
  }
  await visit(root, 0);
  return lines;
}
