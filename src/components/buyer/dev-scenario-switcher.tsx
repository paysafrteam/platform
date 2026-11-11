"use client";

import { Bug, RotateCcw, WifiOff, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { resetDemoStore } from "@/lib/api";
import { toast } from "sonner";

const scenarios = [
  ["demo-awaiting", "Waiting for payment"],
  ["demo-partial", "Partially paid"],
  ["demo-funded", "Money held"],
  ["demo-milestones", "Milestones"],
  ["demo-delivered", "Delivered"],
  ["demo-disputed", "Disputed"],
  ["demo-released", "Paid out"],
  ["demo-refunded", "Refunded"],
  ["demo-expired", "Expired"],
  ["demo-cancelled", "Cancelled"],
  ["demo-overpaid", "Overpaid"],
];

export function DevScenarioSwitcher({ currentToken }: { currentToken: string }) {
  const [open, setOpen] = useState(false);
  if (process.env.NODE_ENV === "production") return null;

  function toggleNetworkError() {
    const active = sessionStorage.getItem("paysafr-force-network-error") === "true";
    sessionStorage.setItem("paysafr-force-network-error", String(!active));
    toast.info(!active ? "Network error simulation is on." : "Network error simulation is off.");
  }

  function reset() {
    resetDemoStore();
    sessionStorage.removeItem("paysafr-force-network-error");
    toast.success("Demo data reset.");
    window.location.reload();
  }

  return (
    <div className="fixed bottom-4 left-4 z-40">
      {open ? (
        <div className="mb-3 w-[min(90vw,300px)] rounded-3xl border border-white/15 bg-[var(--ps-green-900)] p-4 text-white shadow-2xl">
          <div className="flex items-center justify-between"><p className="text-sm">Demo scenarios</p><button className="flex size-9 items-center justify-center rounded-full hover:bg-white/10" onClick={() => setOpen(false)} aria-label="Close demo scenarios"><X size={16} /></button></div>
          <p className="mt-1 text-xs text-white/60">Current: {currentToken}</p>
          <div className="mt-3 grid max-h-56 grid-cols-2 gap-2 overflow-auto">
            {scenarios.map(([token, label]) => <Link key={token} href={`/pay/${token}`} className={`rounded-xl px-2.5 py-2 text-xs ${token === currentToken ? "bg-[var(--ps-green-400)] text-[var(--ps-green-900)]" : "bg-white/10 hover:bg-white/15"}`}>{label}</Link>)}
          </div>
          <div className="mt-3 flex gap-2 border-t border-white/15 pt-3">
            <button type="button" onClick={toggleNetworkError} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-full border border-white/20 text-xs"><WifiOff size={14} /> Network</button>
            <button type="button" onClick={reset} className="inline-flex min-h-10 flex-1 items-center justify-center gap-1 rounded-full border border-white/20 text-xs"><RotateCcw size={14} /> Reset</button>
          </div>
          <p className="mt-2 text-[10px] leading-4 text-white/50">Payment simulations are mock-only. A real order changes only after bank confirmation.</p>
        </div>
      ) : null}
      <button type="button" onClick={() => setOpen(!open)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--ps-green-900)] px-4 text-sm text-white shadow-lg" aria-expanded={open}>
        <Bug size={16} /> Dev
      </button>
    </div>
  );
}
