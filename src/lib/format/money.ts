export function formatNaira(kobo: number): string {
  if (!Number.isSafeInteger(kobo)) throw new TypeError("Money must be stored as integer kobo.");
  const naira = Math.abs(kobo) / 100;
  const decimals = naira % 1 === 0 ? 0 : 2;
  const formatted = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(naira);
  return `${kobo < 0 ? "-" : ""}₦${formatted}`;
}

export function formatNairaCompact(kobo: number): string {
  if (!Number.isSafeInteger(kobo)) throw new TypeError("Money must be stored as integer kobo.");
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(kobo / 100);
}

export function parseNairaInput(value: string): number {
  const digits = value.replace(/[^\d.]/g, "");
  const [whole = "0", fraction = ""] = digits.split(".");
  const amount = Number(`${whole}.${fraction.slice(0, 2)}`);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.round(amount * 100);
}
