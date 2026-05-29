export const workspace = {
  workspaceFolders: [],
  getConfiguration: () => ({
    get: (_key: string, fallback: unknown) => fallback,
    update: async () => undefined
  }),
  asRelativePath: (value: { fsPath?: string } | string) => typeof value === "string" ? value : value.fsPath ?? ""
};

export const window = {
  activeTextEditor: undefined,
  visibleTextEditors: [],
  showInformationMessage: async () => undefined,
  showErrorMessage: async () => undefined,
  showWarningMessage: async () => undefined,
  showInputBox: async () => undefined,
  createOutputChannel: () => ({ appendLine: () => undefined })
};

export const commands = {
  executeCommand: async () => undefined,
  registerCommand: () => ({ dispose: () => undefined })
};

export const env = {
  clipboard: {
    writeText: async () => undefined
  }
};

export const ConfigurationTarget = {
  Workspace: 1,
  Global: 2
};

export const ProgressLocation = {
  Notification: 15
};

export const Uri = {
  joinPath: (...parts: Array<{ fsPath?: string } | string>) => ({ fsPath: parts.map((part) => typeof part === "string" ? part : part.fsPath ?? "").join("/") })
};
