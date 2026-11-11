"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

type BackButtonProps = {
  fallbackHref?: string;
  tone?: "light" | "dark";
  className?: string;
};

export function BackButton({
  fallbackHref = "/",
  tone = "light",
  className = "",
}: BackButtonProps) {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  const toneClasses =
    tone === "dark"
      ? "border-white/25 bg-white/10 text-white hover:bg-white/20"
      : "border-[var(--ps-grey-200)] bg-white text-[var(--ps-green-900)] hover:bg-[var(--ps-green-400)]/15";

  return (
    <button
      type="button"
      aria-label="Go back"
      onClick={goBack}
      className={`group inline-flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ease-[var(--ease-brand)] focus-visible:ring-2 focus-visible:ring-[var(--ps-green-400)] focus-visible:ring-offset-2 ${toneClasses} ${className}`}
    >
      <ArrowLeft
        size={18}
        aria-hidden="true"
        className="transition-transform duration-200 ease-[var(--ease-brand)] group-hover:-translate-x-1"
      />
    </button>
  );
}
