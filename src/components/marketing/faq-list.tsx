"use client";

import { useMemo, useState } from "react";
import { ChevronDown, CircleHelp, Search } from "lucide-react";
import { faqs, type FaqCategory } from "@/content/faqs";

const categories: FaqCategory[] = ["Everyone", "Buyers", "Sellers", "Money", "Disputes"];

export function FaqList({ limit }: { limit?: number }) {
  const [category, setCategory] = useState<FaqCategory>("Everyone");
  const [search, setSearch] = useState("");
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
        {filtered.map((faq) => (
          <details key={faq.question} className="group rounded-3xl bg-[var(--ps-grey-200)]/25 p-4 sm:p-5">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-4 [&::-webkit-details-marker]:hidden">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl border border-[var(--ps-grey-200)] bg-white"><CircleHelp size={18} /></span>
              <span className="flex-1 text-left text-base sm:text-lg">{faq.question}</span>
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[var(--ps-grey-200)] bg-white transition-transform group-open:rotate-180"><ChevronDown size={18} /></span>
            </summary>
            <p className="ml-14 mt-3 max-w-3xl pr-8 text-sm leading-6 text-[var(--ps-grey-600)]">{faq.answer}</p>
          </details>
        ))}
        {filtered.length === 0 ? <p className="py-8 text-center text-sm text-[var(--ps-grey-600)]">No questions match that search.</p> : null}
      </div>
    </div>
  );
}
