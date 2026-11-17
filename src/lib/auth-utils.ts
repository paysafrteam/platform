/** Shared, secret-free helpers for sign-up input. */
export function normalizeNgPhone(input: string): string | null {
  const d = input.replace(/[\s\-().]/g, "");
  let m: RegExpMatchArray | null;
  if ((m = d.match(/^\+?234(\d{10})$/))) return `+234${m[1]}`;
  if ((m = d.match(/^0(\d{10})$/))) return `+234${m[1]}`;
  return null;
}

export function safeNext(path: string | null | undefined, fallback = "/dashboard"): string {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\") || /[\r\n]/.test(path)) return fallback;
  return path;
}

export function maskEmail(email: string): string {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`;
}
export function maskPhone(phone: string): string {
  return phone.length <= 4 ? "***" : `${phone.slice(0, 4)}****${phone.slice(-3)}`;
}
