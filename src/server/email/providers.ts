import "server-only";
import fs from "node:fs";
import path from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { emailConfigured, env } from "@/server/env";
import type { EmailMessage, EmailProvider } from "@/server/email/provider";

const g = globalThis as unknown as { __psMail?: Transporter };

export const smtpProvider: EmailProvider = {
  async send(msg: EmailMessage) {
    const e = env();
    g.__psMail ??= nodemailer.createTransport({
      host: e.SMTP_HOST, port: e.SMTP_PORT ?? 465, secure: (e.SMTP_SECURE ?? "true") === "true",
      auth: { user: e.SMTP_USER, pass: e.SMTP_PASS },
    });
    const info = await g.__psMail.sendMail({ from: e.EMAIL_FROM, to: msg.to, subject: msg.subject, html: msg.html, text: msg.text });
    return { messageId: info.messageId };
  },
};

/** Local development only: when SMTP is not configured, messages are written to .dev-outbox/ so codes can be read locally. */
export const devOutboxProvider: EmailProvider = {
  async send(msg: EmailMessage) {
    const dir = path.join(process.cwd(), ".dev-outbox");
    fs.mkdirSync(dir, { recursive: true });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify({ to: msg.to, subject: msg.subject, text: msg.text }, null, 2));
    return { messageId: `outbox-${id}` };
  },
};

export const getEmailProvider = (): EmailProvider => (emailConfigured() ? smtpProvider : devOutboxProvider);
