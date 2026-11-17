import { SkeletonCard } from "@/components/feedback/states";

export default function Loading() {
  return (
    <main className="min-h-screen bg-[var(--ps-grey-200)]/15">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-8 h-10 w-40 animate-pulse rounded-full bg-[var(--ps-grey-200)]" />
        <div className="grid gap-5 md:grid-cols-[1.05fr_0.95fr]">
          <SkeletonCard /><SkeletonCard />
        </div>
      </div>
    </main>
  );
}
