import { Sparkles } from "lucide-react";

// TODO(DANIEL): replace with the designed Paga Engine card artwork
type PoweredByPagaProps = {
  variant?: "inline" | "footer" | "card";
  tone?: "on-light" | "on-dark";
};

export function PoweredByPaga({
  variant = "inline",
  tone = "on-light",
}: PoweredByPagaProps) {
  const dark = tone === "on-dark";
  const sizing =
    variant === "card"
      ? "rounded-2xl px-5 py-4"
      : variant === "footer"
        ? "rounded-full px-3 py-1.5"
        : "rounded-full px-3 py-2";

  return (
    <span
      className={`inline-flex items-center gap-2 border ${sizing} ${
        dark
          ? "border-white/20 text-white"
          : "border-[var(--ps-grey-200)] bg-white text-[var(--ps-green-900)]"
      }`}
    >
      <Sparkles
        size={16}
        strokeWidth={1.75}
        className={
          dark ? "text-[var(--ps-green-400)]" : "text-[var(--ps-green-900)]"
        }
        aria-hidden="true"
      />
      <span className="flex flex-col leading-none">
        <span
          className={`text-[9px] font-semibold tracking-[0.12em] ${
            dark ? "text-white/70" : "text-[var(--ps-grey-600)]"
          }`}
        >
          POWERED BY
        </span>
        <span className="font-display mt-0.5 text-[16px]">Paga Engine</span>
      </span>
    </span>
  );
}
