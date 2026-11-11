import { Plug } from "lucide-react";
import type { ApiPath } from "@/lib/api/endpoints";

export function ApiPlaceholder({ endpoint }: { endpoint: ApiPath }) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_SHOW_API_PLACEHOLDERS === "false"
  ) {
    return null;
  }
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--ps-grey-200)]/40 px-2.5 py-1 font-mono text-[10px] leading-tight text-[var(--ps-grey-600)]">
      <Plug size={12} aria-hidden="true" />
      {endpoint}
    </span>
  );
}
