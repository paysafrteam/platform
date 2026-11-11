import Image from "next/image";

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
  const imageWidth =
    variant === "card" ? "w-[104px]" : variant === "footer" ? "w-[72px]" : "w-[88px]";

  return (
    <span
      className={`inline-flex items-center gap-2 border ${sizing} ${
        dark
          ? "border-white/20 bg-white"
          : "border-[var(--ps-grey-200)] bg-white"
      }`}
    >
      <Image
        src="/brand/powered-by-paga.png"
        alt="Powered by Paga Engine"
        width={320}
        height={160}
        className={`h-auto ${imageWidth}`}
      />
    </span>
  );
}
