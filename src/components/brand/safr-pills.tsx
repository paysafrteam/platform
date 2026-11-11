type SafrPillsProps = {
  tone?: "default" | "on-green";
};

export function SafrPills({ tone = "default" }: SafrPillsProps) {
  const safer =
    tone === "on-green"
      ? "border-[var(--ps-green-900)] bg-[var(--ps-green-900)] text-white"
      : "border-[var(--ps-green-900)]/15 bg-[var(--ps-green-400)] text-[var(--ps-green-900)]";
  const smarter =
    tone === "on-green"
      ? "border-white bg-white text-[var(--ps-green-900)]"
      : "border-[var(--ps-grey-200)] bg-white text-[var(--ps-black)]";

  return (
    <div
      className="inline-flex items-center gap-2"
      aria-label="Safer. Smarter."
    >
      <span
        className={`inline-flex items-center rounded-full border px-4 py-1.5 text-sm ${safer}`}
      >
        Safer
      </span>
      <span
        className={`inline-flex items-center rounded-full border px-4 py-1.5 text-sm ${smarter}`}
      >
        Smarter
      </span>
    </div>
  );
}
