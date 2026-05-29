import type * as vscode from "vscode";
import { ModelRole } from "./types";

export class ApiKeyStore {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  getSecretKey(role: ModelRole): string {
    return `pmBridge.apiKey.${role}`;
  }

  async getApiKey(role: ModelRole): Promise<string | undefined> {
    return this.secrets.get(this.getSecretKey(role));
  }

  async setApiKey(role: ModelRole, apiKey: string): Promise<void> {
    await this.secrets.store(this.getSecretKey(role), apiKey);
  }

  async clearApiKey(role: ModelRole): Promise<void> {
    await this.secrets.delete(this.getSecretKey(role));
  }

  async hasApiKey(role: ModelRole): Promise<boolean> {
    return Boolean(await this.getApiKey(role));
  }
}
