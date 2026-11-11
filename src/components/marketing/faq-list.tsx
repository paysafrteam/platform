"use client";

import { useId, useMemo, useState } from "react";
import { ChevronDown, CircleHelp, Search } from "lucide-react";
import { faqs, type FaqCategory } from "@/content/faqs";

const categories: FaqCategory[] = ["Everyone", "Buyers", "Sellers", "Money", "Disputes"];

export function FaqList({ limit }: { limit?: number }) {
  const [category, setCategory] = useState<FaqCategory>("Everyone");
  const [search, setSearch] = useState("");
  const [openQuestion, setOpenQuestion] = useState<string | null>(
    faqs[0]?.question ?? null,
  );
  const listId = useId();
  const filtered = useMemo(() => {
    const matches = faqs.filter((faq) => {
      const byCategory = category === "Everyone" || faq.category === category || faq.category === "Everyone";
      const query = search.trim().toLowerCase();
      return byCategory && (!query || `${faq.question} ${faq.answer}`.toLowerCase().includes(query));
    });
    return limit ? matches.slice(0, limit) : matches;
  }, [category, limit, search]);

  return (
    <div>
      {limit ? null : (
        <>
          <label className="mx-auto flex h-12 max-w-lg items-center gap-3 rounded-2xl border border-[var(--ps-grey-200)] px-4">
            <Search size={18} className="text-[var(--ps-grey-600)]" />
            <input className="w-full bg-transparent outline-none" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search questions" />
          </label>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {categories.map((item) => (
              <button key={item} type="button" onClick={() => setCategory(item)} className={`min-h-10 rounded-full px-4 text-sm ${category === item ? "bg-[var(--ps-green-900)] text-white" : "border border-[var(--ps-grey-200)]"}`}>{item}</button>
            ))}
          </div>
        </>
      )}
      <div className="mt-8 space-y-3">
        {filtered.map((faq, index) => {
          const isOpen = openQuestion === faq.question;
          const triggerId = `${listId}-trigger-${index}`;
          const answerId = `${listId}-answer-${index}`;

          return (
            <section
              key={faq.question}
              className="rounded-3xl bg-[var(--ps-grey-200)]/25 p-4 sm:p-5"
            >
              <button
                id={triggerId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={answerId}
                onFocus={() => {
                  if (openQuestion !== faq.question) setOpenQuestion(null);
                }}
                onClick={() =>
                  setOpenQuestion(isOpen ? null : faq.question)
                }
                className="group flex min-h-11 w-full items-center gap-4 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ps-green-400)] focus-visible:ring-offset-2"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--ps-grey-200)] bg-white">
                  <CircleHelp size={18} />
                </span>
                <span className="flex-1 text-base sm:text-lg">
                  {faq.question}
                </span>
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--ps-grey-200)] bg-white transition-transform duration-300 ease-[var(--ease-brand)] ${isOpen ? "rotate-180" : ""}`}
                >
                  <ChevronDown size={18} />
                </span>
              </button>
              <div
                id={answerId}
                role="region"
                aria-labelledby={triggerId}
                aria-hidden={!isOpen}
                inert={!isOpen}
                className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--ease-brand)] ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              >
                <div className="min-h-0 overflow-hidden">
                  <p className="ml-14 mt-3 max-w-3xl pr-8 pb-1 text-sm leading-6 text-[var(--ps-grey-600)]">
                    {faq.answer}
                  </p>
                </div>
              </div>
            </section>
          );
        })}
        {filtered.length === 0 ? <p className="py-8 text-center text-sm text-[var(--ps-grey-600)]">No questions match that search.</p> : null}
      </div>
    </div>
  );
}
