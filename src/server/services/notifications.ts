import "server-only";
import { q, type Db, type Defer } from "@/server/db";
import { sendEmail } from "@/server/email";
import { appUrl, notification } from "@/server/email/templates";

export interface NotifyInput {
  userId: string; type: string; title: string; message: string; orderId?: string;
  email?: { to: string; path?: string; buttonLabel?: string };
}

/** Writes the in-app notification inside the transaction; the email goes out after commit. */
export async function notify(tx: Db, defer: Defer | null, n: NotifyInput) {
  await q(tx, "INSERT INTO notifications (user_id, type, title, message, order_id) VALUES ($1,$2,$3,$4,$5)",
    [n.userId, n.type, n.title, n.message, n.orderId ?? null]);
  if (n.email) {
    const e = n.email;
    const send = () => sendEmail({ to: e.to, template: `notify_${n.type}`,
      content: notification(n.title, n.message, e.path ? { label: e.buttonLabel ?? "Open PaySafr", url: appUrl(e.path) } : undefined) });
    if (defer) defer(send); else void send();
  }
}

/** Email-only message to a buyer (buyers have no account). */
export function emailBuyer(defer: Defer, to: string | null | undefined, title: string, message: string, path: string, label: string) {
  if (!to) return;
  defer(() => sendEmail({ to, template: "buyer_update", content: notification(title, message, { label, url: appUrl(path) }) }));
}
