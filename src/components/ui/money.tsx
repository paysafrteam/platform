import { formatNaira } from "@/lib/format/money";

export function Money({
  kobo,
  className = "",
}: {
  kobo: number;
  className?: string;
}) {
  return <span className={`money ${className}`}>{formatNaira(kobo)}</span>;
}
