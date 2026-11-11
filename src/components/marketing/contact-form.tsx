"use client";

import { useState, type FormEvent } from "react";

export function ContactForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setIsSubmitting(true);
    setStatusMessage("");

    try {
      const response = await fetch("https://formspree.io/f/meagqknd", {
        method: "POST",
        body: new FormData(form),
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        setStatusMessage("We couldn't send your message. Please try again.");
        return;
      }

      form.reset();
      setStatusMessage("Thanks, your message has been sent.");
    } catch {
      setStatusMessage(
        "We couldn't connect to send your message. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      className="surface-card space-y-5 p-6"
      onSubmit={submit}
      aria-busy={isSubmitting}
    >
      <input
        type="hidden"
        name="_subject"
        value="New message from the PaySafr contact form"
      />
      <label className="block text-sm">
        Name
        <input
          required
          name="name"
          autoComplete="name"
          className="mt-2 block h-12 w-full rounded-2xl border border-[var(--ps-grey-200)] px-4"
        />
      </label>
      <label className="block text-sm">
        Email
        <input
          required
          name="email"
          type="email"
          autoComplete="email"
          className="mt-2 block h-12 w-full rounded-2xl border border-[var(--ps-grey-200)] px-4"
        />
      </label>
      <label className="block text-sm">
        Message
        <textarea
          required
          name="message"
          rows={5}
          className="mt-2 block w-full rounded-2xl border border-[var(--ps-grey-200)] p-4"
        />
      </label>
      <button
        type="submit"
        disabled={isSubmitting}
        className="min-h-12 rounded-full bg-[var(--ps-green-400)] px-5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Sending..." : "Send message"}
      </button>
      <p className="text-xs text-[var(--ps-grey-600)]" role="status" aria-live="polite">
        {statusMessage}
      </p>
    </form>
  );
}
