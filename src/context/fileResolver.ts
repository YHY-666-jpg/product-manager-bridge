import * as fs from "node:fs/promises";
import * as path from "node:path";
import { isInsideWorkspace } from "../utils/workspace";

export function extractFileRefs(text: string): string[] {
  const matches = text.matchAll(/@((?!\.\.)[A-Za-z0-9_\-./\\]+\.[A-Za-z0-9]+)/g);
  return [...new Set([...matches].map((match) => match[1].replace(/\\/g, "/")))];
}

export async function readWorkspaceFile(root: string, relativePath: string, maxChars: number): Promise<{ path: string; content?: string; truncated: boolean; warning?: string }> {
  const normalized = path.normalize(relativePath);
  if (normalized.startsWith("..") || path.isAbsolute(normalized)) {
    return { path: relativePath, truncated: false, warning: "Refused path outside workspace." };
  }
  const full = path.join(root, normalized);
  if (!isInsideWorkspace(root, full)) {
    return { path: relativePath, truncated: false, warning: "Refused path outside workspace." };
  }
  try {
    const raw = await fs.readFile(full, "utf8");
    return { path: relativePath, content: raw.slice(0, maxChars), truncated: raw.length > maxChars };
  } catch {
    return { path: relativePath, truncated: false, warning: "File not found or unreadable." };
  }
}
