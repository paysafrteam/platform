export function isNeonDatabaseUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol) &&
      url.hostname.toLowerCase().endsWith(".neon.tech");
  } catch {
    return false;
  }
}

export function assertNeonDatabaseUrl(value: string | undefined, variableName: string): asserts value is string {
  if (!isNeonDatabaseUrl(value)) {
    throw new Error(`${variableName} must be a Neon PostgreSQL URL.`);
  }
}
