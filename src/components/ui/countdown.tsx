"use client";

import { useEffect, useState } from "react";
import { getCountdown } from "@/lib/format/dates";

export function useCurrentTime(refreshMs = 1000) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const update = () => {
      if (document.visibilityState === "visible") setNow(Date.now());
    };
    const timeout = window.setTimeout(update, 0);
    const interval = window.setInterval(update, refreshMs);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [refreshMs]);

  return now;
}

export function Countdown({ target, label = "Time remaining" }: { target: string; label?: string }) {
  const now = useCurrentTime();
  return (
    <span className="money" aria-label={now ? `${label}: ${getCountdown(target, now)}` : `${label}: loading`} aria-live="off">
      {now ? getCountdown(target, now) : "—"}
    </span>
  );
}
