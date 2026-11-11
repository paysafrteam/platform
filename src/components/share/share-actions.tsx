"use client";

import { Download, Link2, MessageCircle } from "lucide-react";
import { toast } from "sonner";

type ShareActionsProps = {
  kind: "receipt" | "invoice" | "link";
  onWhatsApp?: (() => void) | null;
  onInstagram?: (() => void) | null;
  onDownload?: (() => void) | null;
  onCopyLink?: (() => void) | null;
  copyUrl?: string;
};

export function ShareActions({
  kind,
  onWhatsApp = null,
  onInstagram = null,
  onDownload = null,
  onCopyLink = null,
  copyUrl,
}: ShareActionsProps) {
  // TODO(TEMPLATES): wire when receipt and invoice templates are finished
  const copy =
    onCopyLink ??
    (copyUrl
      ? async () => {
          try {
            await navigator.clipboard.writeText(
              new URL(copyUrl, window.location.origin).toString(),
            );
            toast.success("Link copied.");
          } catch (error) {
            console.error("Could not copy the share link", error);
            toast.error(
              "We couldn't copy the link. Please copy it from the address bar.",
            );
          }
        }
      : null);
  const actions = [
    {
      label: "WhatsApp",
      icon: <MessageCircle size={16} />,
      handler: onWhatsApp,
    },
    { label: "Instagram", icon: <InstagramMark />, handler: onInstagram },
    { label: "Download", icon: <Download size={16} />, handler: onDownload },
    { label: "Copy link", icon: <Link2 size={16} />, handler: copy },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {actions.map((action) => (
        <button
          key={action.label}
          type="button"
          title={action.handler ? action.label : "Coming soon"}
          onClick={() => {
            if (action.handler) action.handler();
            else toast.info(`${action.label} for this ${kind} is coming soon.`);
          }}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[var(--ps-grey-200)] px-4 text-sm hover:bg-[var(--ps-grey-200)]/30"
        >
          {action.icon}
          {action.label}
        </button>
      ))}
    </div>
  );
}

function InstagramMark() {
  return (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r=".75" fill="currentColor" stroke="none" />
    </svg>
  );
}
