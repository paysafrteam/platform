import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");
export const sha256Hex = (v: string) => createHash("sha256").update(v).digest("hex");
export const hmacSha256Hex = (v: string, key: string) => createHmac("sha256", key).update(v).digest("hex");
export function timingSafeEqualStr(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
