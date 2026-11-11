import Image from "next/image";

type LogoProps = {
  variant?: "mark" | "wordmark" | "lockup";
  tone?: "on-dark" | "on-light";
  className?: string;
};

export function Logo({
  variant = "lockup",
  tone = "on-light",
  className = "",
}: LogoProps) {
  if (variant === "wordmark") {
    return (
      <span
        className={`font-display inline-flex text-[28px] leading-none tracking-[-0.06em] ${className}`}
        aria-label="PaySafr"
      >
        <span
          className={
            tone === "on-dark" ? "text-white" : "text-[var(--ps-grey-600)]"
          }
        >
          Pay
        </span>
        <span
          className={
            tone === "on-dark"
              ? "text-[var(--ps-green-400)]"
              : "text-[var(--ps-green-900)]"
          }
        >
          Safr
        </span>
      </span>
    );
  }

  const mark = (
    <Image
      src={
        tone === "on-dark"
          ? "/brand/new-mark-dark.svg"
          : "/brand/new-mark-light.svg"
      }
      alt={variant === "mark" ? "PaySafr" : ""}
      width={32}
      height={32}
      priority
      className="h-7 w-7 sm:h-8 sm:w-8"
      aria-hidden={variant !== "mark"}
    />
  );

  if (variant === "mark") {
    return <span className={`inline-flex shrink-0 ${className}`}>{mark}</span>;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      aria-label="PaySafr"
    >
      {mark}
      <span className="font-display inline-flex text-[28px] leading-none tracking-[-0.06em]">
        <span
          className={
            tone === "on-dark" ? "text-white" : "text-[var(--ps-grey-600)]"
          }
        >
          Pay
        </span>
        <span
          className={
            tone === "on-dark"
              ? "text-[var(--ps-green-400)]"
              : "text-[var(--ps-green-900)]"
          }
        >
          Safr
        </span>
      </span>
    </span>
  );
}
