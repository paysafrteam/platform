import "server-only";
import { env } from "@/server/env";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export interface Rendered { subject: string; html: string; text: string }

function layout(opts: { preheader: string; heading: string; paragraphs: string[]; code?: string; button?: { label: string; url: string }; footnote?: string }): string {
  const ps = opts.paragraphs.map((p) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:#112b00">${esc(p)}</p>`).join("");
  const code = opts.code
    ? `<p style="margin:8px 0 24px;font-size:34px;letter-spacing:8px;font-weight:700;color:#112b00;font-family:Consolas,monospace">${esc(opts.code)}</p>` : "";
  const button = opts.button
    ? `<p style="margin:8px 0 24px"><a href="${esc(opts.button.url)}" style="background:#112b00;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;display:inline-block">${esc(opts.button.label)}</a></p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#f4f4f4;font-family:Arial,Helvetica,sans-serif">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden">
<tr><td style="background:#112b00;padding:20px 28px;font-size:24px;font-weight:700"><span style="color:#ffffff">Pay</span><span style="color:#66ff00">Safr</span></td></tr>
<tr><td style="padding:28px"><h1 style="margin:0 0 16px;font-size:22px;color:#112b00">${esc(opts.heading)}</h1>${ps}${code}${button}
${opts.footnote ? `<p style="margin:0;font-size:13px;color:#666666">${esc(opts.footnote)}</p>` : ""}</td></tr>
<tr><td style="border-top:1px solid #cccccc;padding:16px 28px;font-size:12px;color:#777777">Powered by Paga Engine &middot; PaySafr, work delivered, payment secured.</td></tr>
</table></td></tr></table></body></html>`;
}

function plain(heading: string, paragraphs: string[], code?: string, button?: { label: string; url: string }, footnote?: string) {
  return [heading, "", ...paragraphs, ...(code ? ["", code] : []), ...(button ? ["", `${button.label}: ${button.url}`] : []), ...(footnote ? ["", footnote] : []), "", "PaySafr, powered by Paga Engine"].join("\n");
}

export const appUrl = (p = "") => `${env().NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}${p}`;

export function verifyEmail(code: string): Rendered {
  const paragraphs = ["Use this code to verify your email and finish creating your PaySafr account.", "It expires in 10 minutes."];
  const foot = "If you did not request this, ignore this email.";
  return { subject: "Your PaySafr verification code", html: layout({ preheader: `Your code is ${code}`, heading: "Verify your email", paragraphs, code, footnote: foot }), text: plain("Verify your email", paragraphs, code, undefined, foot) };
}
export function resetPassword(code: string): Rendered {
  const paragraphs = ["Use this code to reset your PaySafr password.", "It expires in 10 minutes."];
  const foot = "If you did not request this, ignore this email. Your password will not change.";
  return { subject: "Your PaySafr password reset code", html: layout({ preheader: `Your code is ${code}`, heading: "Reset your password", paragraphs, code, footnote: foot }), text: plain("Reset your password", paragraphs, code, undefined, foot) };
}
export function passwordChanged(): Rendered {
  const paragraphs = ["Your PaySafr password was just changed and all other sessions were signed out."];
  const foot = "If this was not you, reset your password now and contact support.";
  return { subject: "Your PaySafr password was changed", html: layout({ preheader: "Password changed", heading: "Password changed", paragraphs, footnote: foot }), text: plain("Password changed", paragraphs, undefined, undefined, foot) };
}
export function notification(title: string, message: string, button?: { label: string; url: string }): Rendered {
  return { subject: title, html: layout({ preheader: message.slice(0, 90), heading: title, paragraphs: [message], button }), text: plain(title, [message], undefined, button) };
}
