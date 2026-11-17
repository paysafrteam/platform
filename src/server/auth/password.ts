import "server-only";
import bcrypt from "bcryptjs";
import { AppError } from "@/server/http/errors";

const COST = 12;
export const hashPassword = (pw: string) => bcrypt.hash(pw, COST);
export const verifyPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);
// Compared against when an account does not exist, so response time does not reveal it.
let dummy: string | undefined;
export const dummyHash = () => (dummy ??= bcrypt.hashSync("paysafr-dummy-password-1", COST));

export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "Use at least 8 characters.";
  if (Buffer.byteLength(pw) > 72) return "Use 72 bytes or fewer.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "Use a mix of letters and numbers.";
  return null;
}
export function assertPassword(pw: string, field = "password") {
  const p = passwordProblem(pw);
  if (p) throw new AppError("VALIDATION", p, { [field]: p });
}
