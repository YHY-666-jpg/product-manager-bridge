import * as vscode from "vscode";
import { SecretScanner } from "../security/SecretScanner";
import { getWorkspaceRoot } from "../utils/workspace";
import { extractFileRefs, readWorkspaceFile } from "./fileResolver";
import { getGitDiff, getGitStatus } from "./git";
import { buildTree } from "./tree";

export interface ContextFile {
  path: string;
  chars: number;
  truncated: boolean;
  sensitiveHit: boolean;
  content?: string;
  warning?: string;
}

export interface ProjectContext {
  workspaceRoot?: string;
  tree: string[];
  activeFile?: string;
  visibleFiles: string[];
  explicitFiles: ContextFile[];
  gitStatusAttached: boolean;
  gitDiffAttached: boolean;
  gitStatus: string;
  gitDiff: string;
  warnings: string[];
}

export class ContextBuilder {
  private readonly scanner = new SecretScanner();

  async build(userRequirement: string, extraFiles: string[] = []): Promise<ProjectContext> {
    const root = getWorkspaceRoot();
    if (!root) {
      return { tree: [], visibleFiles: [], explicitFiles: [], gitStatusAttached: false, gitDiffAttached: false, gitStatus: "", gitDiff: "", warnings: ["No workspace folder is open."] };
    }
    const config = vscode.workspace.getConfiguration("pmBridge");
    const maxFileChars = config.get<number>("context.maxFileChars", 40000);
    const maxTreeDepth = config.get<number>("context.maxTreeDepth", 4);
    const maxTreeEntries = config.get<number>("context.maxTreeEntries", 300);
    const maxVisibleEditors = config.get<number>("context.maxVisibleEditors", 5);
    const refs = [...new Set([...extractFileRefs(userRequirement), ...extraFiles])];
    const explicitFiles = await Promise.all(refs.map(async (ref) => {
      const read = await readWorkspaceFile(root, ref, maxFileChars);
      const scan = read.content ? this.scanner.scanAndRedact(read.content) : undefined;
      return {
        path: read.path,
        chars: scan?.text.length ?? 0,
        truncated: read.truncated,
        sensitiveHit: Boolean(scan?.hitCount),
        content: scan?.text,
        warning: read.warning
      };
    }));
    const activeFile = vscode.window.activeTextEditor?.document.uri.scheme === "file"
      ? vscode.workspace.asRelativePath(vscode.window.activeTextEditor.document.uri)
      : undefined;
    const visibleFiles = [...new Set(vscode.window.visibleTextEditors
      .filter((editor) => editor.document.uri.scheme === "file")
      .map((editor) => vscode.workspace.asRelativePath(editor.document.uri)))]
      .slice(0, maxVisibleEditors);
    const [tree, gitStatus, rawDiff] = await Promise.all([buildTree(root, maxTreeDepth, maxTreeEntries), getGitStatus(root), getGitDiff(root)]);
    const diffScan = this.scanner.scanAndRedact(rawDiff);
    return {
      workspaceRoot: root,
      tree,
      activeFile,
      visibleFiles,
      explicitFiles,
      gitStatusAttached: Boolean(gitStatus),
      gitDiffAttached: Boolean(diffScan.text),
      gitStatus,
      gitDiff: diffScan.text,
      warnings: explicitFiles.flatMap((file) => file.warning ? [`${file.path}: ${file.warning}`] : [])
    };
  }

  summarize(context: ProjectContext): object {
    return {
      workspaceRoot: context.workspaceRoot,
      treeAttached: context.tree.length > 0,
      activeFile: context.activeFile,
      visibleFiles: context.visibleFiles,
      explicitFiles: context.explicitFiles.map((file) => ({ path: file.path, chars: file.chars, truncated: file.truncated, sensitiveHit: file.sensitiveHit, warning: file.warning })),
      gitStatusAttached: context.gitStatusAttached,
      gitDiffAttached: context.gitDiffAttached,
      warnings: context.warnings
    };
  }
}
