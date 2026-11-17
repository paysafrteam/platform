import "server-only";
import { q } from "@/server/db";
import { sha256Hex } from "@/server/ids";
import { AppError } from "@/server/http/errors";
import { getEmailProvider } from "@/server/email/providers";
import type { Rendered } from "@/server/email/templates";

export interface SendEmailInput { to: string; template: string; content: Rendered; critical?: boolean }

/** Logs a hash of the recipient only. Non-critical failures are swallowed so email never rolls back a money action. */
export async function sendEmail({ to, template, content, critical = false }: SendEmailInput): Promise<boolean> {
  const toHash = sha256Hex(to.trim().toLowerCase());
  try {
    const res = await getEmailProvider().send({ to, subject: content.subject, html: content.html, text: content.text });
    await q(undefined, "INSERT INTO email_log (to_hash, template, status, provider_message_id) VALUES ($1,$2,'sent',$3)", [toHash, template, res.messageId ?? null]);
    return true;
  } catch (e) {
    await q(undefined, "INSERT INTO email_log (to_hash, template, status, error) VALUES ($1,$2,'failed',$3)", [toHash, template, (e instanceof Error ? e.message : "error").slice(0, 200)]).catch(() => undefined);
    if (critical) throw new AppError("INTERNAL", "We could not send the email. Please try again.");
    console.error(`[email] ${template} failed`);
    return false;
  }
}
