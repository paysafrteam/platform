import { notFound } from "next/navigation";
import Link from "next/link";

const glyphs = `ABCDEFGHIJKLMNOPQRSTUVWXYZ
abcdefghijklmnopqrstuvwxyz
0123456789
% : ; ! ? - + / & @ # ( ) $ ' " ₦
₦150,000 · 2% fee · @usepaysafr`;

export default function TypographyPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <Link className="text-sm underline" href="/">
        Back to PaySafr
      </Link>
      <p className="mt-10 text-xs font-semibold tracking-[0.14em] text-[var(--ps-grey-600)] uppercase">
        Development only · Font specimen
      </p>
      <h1 className="font-display mt-2 text-5xl">Typography and glyph check</h1>
      <p className="mt-3 max-w-2xl text-[var(--ps-grey-600)]">
        Compare the supplied demo fonts with the Inter fallback. Missing
        characters should be supplied by the next font in each stack.
      </p>
      <section className="mt-8 grid gap-5">
        <article className="surface-card p-6">
          <h2 className="text-lg">Degular Demo</h2>
          <p className="mt-3 [font-family:var(--font-degular),var(--font-fallback)] text-xl break-words">
            {glyphs}
          </p>
        </article>
        <article className="surface-card p-6">
          <h2 className="text-lg">Halfre</h2>
          <p className="font-display mt-3 text-3xl break-words">{glyphs}</p>
        </article>
        <article className="surface-card p-6">
          <h2 className="text-lg">Money display (Inter fallback)</h2>
          <p className="money mt-3 text-4xl">₦150,000.50</p>
        </article>
      </section>
      <p className="mt-6 text-sm text-[var(--ps-grey-600)]">
        Test characters: <code>{`% : ; ! ? - + / & @ # ( ) $ ' " ₦`}</code>
      </p>
    </main>
  );
}
