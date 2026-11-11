import { AlertCircle, Inbox, RefreshCw } from "lucide-react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="surface-card flex flex-col items-center px-6 py-12 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-[var(--ps-green-400)]/20">
        <Inbox size={22} />
      </span>
      <h2 className="font-display mt-4 text-2xl">{title}</h2>
      <p className="mt-2 max-w-md text-sm text-[var(--ps-grey-600)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ retry }: { retry: () => void }) {
  return (
    <div className="rounded-3xl border border-[var(--ps-danger)]/30 bg-[var(--ps-danger)]/5 p-6">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-1 shrink-0 text-[var(--ps-danger)]" />
        <div>
          <h2 className="text-lg">We couldn&apos;t load this just now</h2>
          <p className="mt-1 text-sm text-[var(--ps-grey-600)]">
            Check your connection, then try again. Your order details have not changed.
          </p>
          <button
            type="button"
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--ps-green-900)] px-4"
            onClick={retry}
          >
            <RefreshCw size={16} /> Try again
          </button>
        </div>
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="surface-card animate-pulse space-y-4 p-6" aria-label="Loading">
      <div className="h-4 w-1/3 rounded-full bg-[var(--ps-grey-200)]" />
      <div className="h-8 w-2/3 rounded-full bg-[var(--ps-grey-200)]" />
      <div className="h-4 w-full rounded-full bg-[var(--ps-grey-200)]" />
      <div className="h-4 w-4/5 rounded-full bg-[var(--ps-grey-200)]" />
      <div className="h-12 w-full rounded-2xl bg-[var(--ps-grey-200)]" />
    </div>
  );
}
