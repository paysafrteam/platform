"use client";

import { ArrowRight, Plus } from "lucide-react";
import { calcFee, calcSellerReceives } from "@/lib/domain/rules";
import { formatNaira } from "@/lib/format/money";

export function CreateWizard(props: {
  step: number;
  setStep: (n: number) => void;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  amount: string;
  setAmount: (v: string) => void;
  multi: boolean;
  setMulti: (v: boolean) => void;
  milestones: { title: string; amount: string }[];
  setMilestones: (v: { title: string; amount: string }[]) => void;
  deadline: string;
  setDeadline: (v: string) => void;
  reviewHours: number;
  setReviewHours: (v: number) => void;
  buyer: string;
  setBuyer: (v: string) => void;
  submitting: boolean;
  amountKobo: number;
  allocationValid: boolean;
  submitOrder: (publish: boolean) => void;
}) {
  const {
    step,
    setStep,
    title,
    setTitle,
    description,
    setDescription,
    amount,
    setAmount,
    multi,
    setMulti,
    milestones,
    setMilestones,
    deadline,
    setDeadline,
    reviewHours,
    setReviewHours,
    buyer,
    setBuyer,
    submitting,
    amountKobo,
    allocationValid,
    submitOrder,
  } = props;
  const allocated = milestones.reduce(
    (sum, item) => sum + Math.round(Number(item.amount || 0) * 100),
    0,
  );
  const remaining = amountKobo - allocated;
  return (
    <section className="surface-card p-5 sm:p-8">
      <div className="mb-7 flex gap-2">
        {["Details", "Amount", "Terms", "Review"].map((item, index) => (
          <div
            key={item}
            className={`h-1.5 flex-1 rounded-full ${step >= index ? "bg-[var(--ps-green-900)]" : "bg-[var(--ps-grey-200)]"}`}
            aria-label={`${item}, step ${index + 1}`}
          />
        ))}
      </div>
      {step === 0 ? (
        <div className="space-y-5">
          <h2 className="font-display text-2xl">What are you selling?</h2>
          <label className="block text-sm">
            Order title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              maxLength={100}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-4"
              placeholder="For example, Brand identity design"
            />
          </label>
          <label className="block text-sm">
            Description
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              maxLength={1000}
              className="mt-2 w-full rounded-xl border border-[var(--ps-grey-200)] p-4"
              placeholder="Describe what the buyer will receive."
            />
          </label>
        </div>
      ) : null}
      {step === 1 ? (
        <div className="space-y-5">
          <h2 className="font-display text-2xl">Set the amount.</h2>
          <label className="block text-sm">
            Total order amount
            <input
              type="number"
              min="1"
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="money mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-4"
              placeholder="₦ 0.00"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMulti(false)}
              className={`rounded-2xl border p-4 text-left ${!multi ? "border-[var(--ps-green-900)] bg-[var(--ps-green-400)]/10" : "border-[var(--ps-grey-200)]"}`}
            >
              <strong className="text-sm">One payment</strong>
              <span className="mt-1 block text-xs text-[var(--ps-grey-600)]">
                Pay the full amount once.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMulti(true)}
              className={`rounded-2xl border p-4 text-left ${multi ? "border-[var(--ps-green-900)] bg-[var(--ps-green-400)]/10" : "border-[var(--ps-grey-200)]"}`}
            >
              <strong className="text-sm">In milestones</strong>
              <span className="mt-1 block text-xs text-[var(--ps-grey-600)]">
                Release payment as work progresses.
              </span>
            </button>
          </div>
          {multi ? (
            <div className="space-y-3">
              {milestones.map((item, index) => (
                <div
                  key={index}
                  className="grid gap-2 sm:grid-cols-[1fr_150px_auto]"
                >
                  <input
                    aria-label={`Milestone ${index + 1} title`}
                    value={item.title}
                    onChange={(event) =>
                      setMilestones(
                        milestones.map((row, i) =>
                          i === index
                            ? { ...row, title: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className="h-11 rounded-xl border border-[var(--ps-grey-200)] px-3"
                    placeholder={`Milestone ${index + 1}`}
                  />
                  <input
                    aria-label={`Milestone ${index + 1} amount`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.amount}
                    onChange={(event) =>
                      setMilestones(
                        milestones.map((row, i) =>
                          i === index
                            ? { ...row, amount: event.target.value }
                            : row,
                        ),
                      )
                    }
                    className="h-11 rounded-xl border border-[var(--ps-grey-200)] px-3"
                    placeholder="Amount ₦"
                  />
                  <button
                    type="button"
                    aria-label="Remove milestone"
                    disabled={milestones.length <= 1}
                    onClick={() =>
                      setMilestones(milestones.filter((_, i) => i !== index))
                    }
                    className="min-h-11 rounded-full border px-3 disabled:opacity-40"
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setMilestones([...milestones, { title: "", amount: "" }])
                }
                className="inline-flex min-h-11 items-center gap-2 text-sm underline"
              >
                <Plus size={15} /> Add milestone
              </button>
              <p
                className={`text-sm ${remaining === 0 ? "text-[var(--ps-green-900)]" : "text-[var(--ps-grey-600)]"}`}
              >
                {remaining >= 0
                  ? `${formatNaira(remaining)} left to allocate`
                  : `${formatNaira(Math.abs(remaining))} over allocated`}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      {step === 2 ? (
        <div className="space-y-5">
          <h2 className="font-display text-2xl">Agree the terms.</h2>
          <label className="block text-sm">
            Delivery deadline
            <input
              type="date"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-4"
            />
          </label>
          <label className="block text-sm">
            Buyer review window
            <select
              value={reviewHours}
              onChange={(event) => setReviewHours(Number(event.target.value))}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-4"
            >
              {[
                [24, "24 hours"],
                [48, "48 hours"],
                [72, "72 hours"],
                [168, "7 days"],
                [336, "14 days"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-[var(--ps-grey-600)]">
              Funds release after the buyer confirms or their review time ends
              without a dispute.
            </span>
          </label>
          <label className="block text-sm">
            Buyer email or phone (optional)
            <input
              value={buyer}
              onChange={(event) => setBuyer(event.target.value)}
              className="mt-2 h-12 w-full rounded-xl border border-[var(--ps-grey-200)] px-4"
            />
          </label>
        </div>
      ) : null}
      {step === 3 ? (
        <div>
          <h2 className="font-display text-2xl">Review your order.</h2>
          <div className="mt-5 space-y-3 rounded-2xl bg-[var(--ps-grey-200)]/25 p-4 text-sm">
            <p>
              <span className="text-[var(--ps-grey-600)]">Title: </span>
              {title || "Untitled order"}
            </p>
            <p>
              <span className="text-[var(--ps-grey-600)]">Total: </span>
              <span className="money">{formatNaira(amountKobo)}</span>
            </p>
            <p>
              <span className="text-[var(--ps-grey-600)]">PaySafr fee: </span>
              <span className="money">{formatNaira(calcFee(amountKobo))}</span>
            </p>
            <p>
              <span className="text-[var(--ps-grey-600)]">You receive: </span>
              <span className="money">
                {formatNaira(calcSellerReceives(amountKobo))}
              </span>
            </p>
            <p>
              Delivery by {deadline || "Choose a date"} · {reviewHours} hour
              review window
            </p>
          </div>
          <p className="mt-4 text-xs text-[var(--ps-grey-600)]">
            Publishing creates a payment link and a bank account number for this
            order only. You can share the link with your buyer straight away.
          </p>
        </div>
      ) : null}
      <div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-[var(--ps-grey-200)] pt-5">
        <button
          type="button"
          onClick={() => setStep(Math.max(0, step - 1))}
          disabled={step === 0 || submitting}
          className="min-h-11 rounded-full border border-[var(--ps-grey-200)] px-5 disabled:opacity-40"
        >
          Back
        </button>
        <div className="flex flex-wrap gap-2">
          {step === 3 ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitOrder(false)}
              className="min-h-11 rounded-full border border-[var(--ps-grey-200)] px-5"
            >
              Save as draft
            </button>
          ) : null}
          {step < 3 ? (
            <button
              type="button"
              onClick={() => setStep(step + 1)}
              disabled={
                (step === 0 && !title.trim()) ||
                (step === 1 && (!allocationValid || !amountKobo)) ||
                (step === 2 && !deadline)
              }
              className="min-h-11 rounded-full bg-[var(--ps-green-400)] px-5 disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting || !allocationValid}
              onClick={() => submitOrder(true)}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--ps-green-400)] px-5 disabled:opacity-50"
            >
              {submitting ? "Publishing…" : "Publish order"}{" "}
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

