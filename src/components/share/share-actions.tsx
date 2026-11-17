"use client";

import { Download, Link2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

type ShareActionsProps = { kind: "receipt" | "invoice" | "link"; copyUrl?: string; shareText?: string };

function absolute(url: string) {
  return new URL(url, window.location.origin).toString();
}

export function ShareActions({ kind, copyUrl, shareText }: ShareActionsProps) {
  async function copy(message = "Link copied.") {
    if (!copyUrl) return;
    try {
      await navigator.clipboard.writeText(absolute(copyUrl));
      toast.success(message);
    } catch {
      toast.error("We couldn't copy the link. Please copy it from the address bar.");
    }
  }
  const actions: { label: string; icon: React.ReactNode; run: () => void }[] = [];
  if (copyUrl) {
    actions.push({
      label: "WhatsApp", icon: <MessageCircle size={16} />,
      run: () => window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText ?? `Your PaySafr ${kind}`} ${absolute(copyUrl)}`)}`, "_blank", "noopener,noreferrer"),
    });
    actions.push({ label: "Instagram", icon: <InstagramMark />, run: () => void copy("Link copied. Paste it into your Instagram message.") });
  }
  if (kind !== "link") actions.push({ label: "Download", icon: <Download size={16} />, run: () => window.print() });
  if (copyUrl) actions.push({ label: "Copy link", icon: <Link2 size={16} />, run: () => void copy() });
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {actions.map((a) => (
        <button key={a.label} type="button" onClick={a.run}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--ps-grey-200)] px-4 text-sm hover:bg-[var(--ps-grey-200)]/30">
          {a.icon}{a.label}
        </button>
      ))}
    </div>
  );
}

function InstagramMark() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r=".75" fill="currentColor" stroke="none" />
    </svg>
  );
}
