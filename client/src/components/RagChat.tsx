import { useState } from "react";
import type { RagAnswer } from "../api/types";
import type { copy, UiLocale } from "../copy";

type T = (typeof copy)[UiLocale];

export function RagChat({
  t,
  locale,
  documentId,
  onAsk,
  result,
  busy,
}: {
  t: T;
  locale: UiLocale;
  documentId?: string;
  onAsk: (query: string) => void;
  result: RagAnswer | null;
  busy: boolean;
}) {
  const [query, setQuery] = useState("");
  return (
    <section className="border border-(--color-rule) bg-white p-4">
      <h2 className="text-sm font-semibold">{t.rag}</h2>
      <p className="mt-1 text-sm text-stone-600">{t.ragHint}</p>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) {
            onAsk(query.trim());
          }
        }}
      >
        <input
          className="flex-1 rounded border border-(--color-rule) px-3 py-2 text-sm"
          value={query}
          dir={locale === "ar" ? "rtl" : "ltr"}
          onChange={(e) => setQuery(e.target.value)}
          aria-label={t.rag}
        />
        <button
          type="submit"
          disabled={busy || query.trim().length === 0}
          className="rounded bg-(--color-ink) px-4 py-2 text-sm text-(--color-paper) disabled:opacity-40"
        >
          {t.ask}
        </button>
      </form>
      {documentId ? <p className="mt-2 font-mono text-[11px] text-stone-500">{documentId}</p> : null}
      {result?.refused ? <p className="mt-3 text-sm text-(--color-accent)">{t.refused}</p> : null}
      {result && !result.refused ? (
        <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap font-sans text-sm leading-relaxed">
          {result.answer}
        </pre>
      ) : null}
    </section>
  );
}
