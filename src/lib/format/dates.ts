const lagosTime = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  dateStyle: "medium",
  timeStyle: "short",
  hour12: true,
});

export function formatLagosDate(value: string | Date): string {
  return lagosTime.format(typeof value === "string" ? new Date(value) : value);
}

export function getCountdown(target: string | Date, now = Date.now()): string {
  const end = typeof target === "string" ? new Date(target).getTime() : target.getTime();
  const seconds = Math.max(0, Math.floor((end - now) / 1000));
  if (seconds < 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  }
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days ? `${days}d ` : ""}${hours}h ${minutes}m`;
}

export function relativeDate(value: string): string {
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  const amount =
    abs < 3600
      ? Math.max(1, Math.round(abs / 60))
      : abs < 86400
        ? Math.round(abs / 3600)
        : Math.round(abs / 86400);
  const unit = abs < 3600 ? "minute" : abs < 86400 ? "hour" : "day";
  return new Intl.RelativeTimeFormat("en-NG", { numeric: "auto" }).format(
    Math.sign(seconds) * amount,
    unit,
  );
}
