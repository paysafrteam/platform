"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function CopyField({
  label,
  value,
  large = false,
}: {
  label: string;
  value: string;
  large?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      toast.error("Couldn't copy. Select and copy the text instead.");
      console.error("Clipboard write failed", error);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--ps-grey-200)] py-3 last:border-0">
      <div className="min-w-0">
        <p className="text-xs text-[var(--ps-grey-600)]">{label}</p>
        <p className={`${large ? "money text-xl tracking-wide" : "text-sm"} truncate`}>
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border border-[var(--ps-grey-200)] px-3 text-xs hover:bg-[var(--ps-grey-200)]/30"
        aria-label={`Copy ${label.toLowerCase()}`}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
        <span className="sr-only sm:not-sr-only">{copied ? "Copied" : "Copy"}</span>
      </button>
    </div>
  );
}
