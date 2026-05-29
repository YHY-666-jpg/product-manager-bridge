export interface SecretScanResult {
  text: string;
  hitCount: number;
  findings: string[];
}

interface Pattern {
  name: string;
  regex: RegExp;
}

const patterns: Pattern[] = [
  { name: "Bearer token", regex: /Bearer\s+[A-Za-z0-9._~+/=-]{16,}/gi },
  { name: "Private key", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { name: "Postgres connection string", regex: /postgres(?:ql)?:\/\/[^\s"'`]+/gi },
  { name: "GitHub token", regex: /gh[pousr]_[A-Za-z0-9_]{20,}/g }
];

export class SecretScanner {
  scanAndRedact(input: string): SecretScanResult {
    let text = input;
    const findings = new Set<string>();
    for (const pattern of patterns) {
      text = text.replace(pattern.regex, () => {
        findings.add(pattern.name);
        return `[REDACTED ${pattern.name}]`;
      });
    }
    return { text, hitCount: findings.size, findings: [...findings] };
  }
}
