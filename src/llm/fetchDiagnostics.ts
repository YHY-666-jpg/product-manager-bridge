import { ModelProviderConfig } from "./types";

export async function fetchWithDiagnostics(
  config: ModelProviderConfig,
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit
): Promise<Response> {
  const attempts = Math.max(1, config.maxRetries + 1);
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.requestTimeoutMs);
    try {
      return await fetchImpl(url, { ...init, signal: controller.signal });
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || isAbortError(error)) {
        break;
      }
      await sleep(Math.min(250 * attempt, 1000));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(formatFetchFailure(config, url, lastError));
}

export async function throwHttpError(config: ModelProviderConfig, url: string, response: Response): Promise<never> {
  const body = await response.text().catch(() => "");
  const suffix = body ? ` Response: ${clip(body)}` : "";
  throw new Error(`${config.providerName} provider failed with HTTP ${response.status} ${response.statusText || ""} at ${safeTarget(url)}.${suffix}`);
}

function formatFetchFailure(config: ModelProviderConfig, url: string, error: unknown): string {
  const details = describeError(error);
  return [
    `${config.providerName} provider fetch failed before receiving an HTTP response at ${safeTarget(url)}.`,
    details ? `Cause: ${details}.` : "",
    "Check Base URL, proxy/VPN, firewall, DNS, certificate, and whether VS Code can access the network."
  ].filter(Boolean).join(" ");
}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }
  if (isAbortError(error)) {
    return `request timed out after ${error.message}`;
  }
  const cause = (error as Error & { cause?: unknown }).cause;
  const causeDetails = describeCause(cause);
  return [error.message, causeDetails].filter(Boolean).join("; ");
}

function describeCause(cause: unknown): string {
  if (!cause || typeof cause !== "object") {
    return "";
  }
  const record = cause as Record<string, unknown>;
  return [
    record.code ? `code=${String(record.code)}` : "",
    record.syscall ? `syscall=${String(record.syscall)}` : "",
    record.hostname ? `host=${String(record.hostname)}` : "",
    record.address ? `address=${String(record.address)}` : "",
    record.message ? String(record.message) : ""
  ].filter(Boolean).join(", ");
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function safeTarget(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return url;
  }
}

function clip(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 500 ? `${compact.slice(0, 500)}...` : compact;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
