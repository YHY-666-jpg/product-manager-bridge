import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function git(root: string, args: string[]): Promise<string> {
  try {
    const result = await execFileAsync("git", args, { cwd: root, timeout: 5000, maxBuffer: 1024 * 512 });
    return result.stdout.trim();
  } catch {
    return "";
  }
}

export async function getGitStatus(root: string): Promise<string> {
  return git(root, ["status", "--short"]);
}

export async function getGitDiff(root: string): Promise<string> {
  return git(root, ["diff", "--", "."]);
}
