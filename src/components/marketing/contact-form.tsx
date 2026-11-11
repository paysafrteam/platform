"use client";

import { useState } from "react";
import { toast } from "sonner";

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    toast.info("This contact form is a demo. Your message has not been sent.");
  }

  return (
    <form className="surface-card space-y-5 p-6" onSubmit={submit}>
      <label className="block text-sm">Name<input required name="name" autoComplete="name" className="mt-2 block h-12 w-full rounded-2xl border border-[var(--ps-grey-200)] px-4" /></label>
      <label className="block text-sm">Email<input required name="email" type="email" autoComplete="email" className="mt-2 block h-12 w-full rounded-2xl border border-[var(--ps-grey-200)] px-4" /></label>
      <label className="block text-sm">Message<textarea required name="message" rows={5} className="mt-2 block w-full rounded-2xl border border-[var(--ps-grey-200)] p-4" /></label>
      <button type="submit" className="min-h-12 rounded-full bg-[var(--ps-green-400)] px-5">Send message</button>
      <p className="text-xs text-[var(--ps-grey-600)]" role="status" aria-live="polite">
        {submitted ? "Demo only. Your message has not been sent." : "This demo form does not send messages."}
      </p>
    </form>
  );
}
