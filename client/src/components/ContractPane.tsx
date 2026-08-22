import type { ContractRecord, ContractSummary } from "../api/types";
import type { copy } from "../copy";
import type { UiLocale } from "../copy";

type T = (typeof copy)[UiLocale];

interface Props {
  t: T;
  locale: UiLocale;
  items: ContractSummary[];
  selected: ContractRecord | null;
  clauses: { id: string; heading: string; title: string; text: string; category: string }[];
  onSelect: (id: string) => void;
  onUpload: (file: File) => void;
}

export function ContractPane({ t, locale, items, selected, clauses, onSelect, onUpload }: Props) {
  const corpus = items.filter((i) => i.source === "corpus");
  const uploads = items.filter((i) => i.source === "upload");

  return (
    <section className="flex min-h-0 flex-col border border-(--color-rule) bg-white">
      <header className="border-b border-(--color-rule) px-4 py-3">
        <h2 className="text-sm font-semibold">{t.selectContract}</h2>
        <label className="mt-3 block">
          <span className="sr-only">{t.selectContract}</span>
          <select
            className="w-full rounded border border-(--color-rule) bg-(--color-paper) px-3 py-2 text-sm"
            value={selected?.id ?? ""}
            onChange={(e) => {
              if (e.target.value) {
                onSelect(e.target.value);
              }
            }}
          >
            <option value="">{t.noContract}</option>
            <optgroup label={t.corpus}>
              {corpus.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.highRisk ? `⚠ ${c.title}` : c.title} ({c.language})
                </option>
              ))}
            </optgroup>
            {uploads.length > 0 ? (
              <optgroup label={t.uploaded}>
                {uploads.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>
        <label className="mt-2 inline-flex cursor-pointer text-xs font-medium text-(--color-accent) underline">
          {t.upload}
          <input
            type="file"
            accept=".txt,.md,text/plain,text/markdown"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onUpload(file);
              }
              e.target.value = "";
            }}
          />
        </label>
      </header>
      <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-2">
        <article className="min-h-48 overflow-auto border-(--color-rule) p-4 md:border-e">
          <h3 className="text-xs font-semibold tracking-wide uppercase">{t.original}</h3>
          {selected?.highRisk ? (
            <p className="mt-2 text-xs font-medium text-(--color-accent)">{t.highRisk}</p>
          ) : null}
          <pre
            className="mt-3 whitespace-pre-wrap font-sans text-sm leading-relaxed"
            dir={selected?.language === "ar" || locale === "ar" ? "rtl" : "ltr"}
          >
            {selected?.text ?? t.noContract}
          </pre>
        </article>
        <article className="min-h-48 overflow-auto p-4">
          <h3 className="text-xs font-semibold tracking-wide uppercase">{t.clauses}</h3>
          <ul className="mt-3 space-y-3">
            {clauses.length === 0 ? (
              <li className="text-sm text-stone-600">{t.noContract}</li>
            ) : (
              clauses.map((c) => (
                <li key={c.id} className="border border-(--color-rule) p-3">
                  <p className="text-xs font-medium text-(--color-accent)">{c.category}</p>
                  <p className="mt-1 text-sm font-semibold">{c.heading || c.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-stone-700">{c.text.slice(0, 420)}</p>
                </li>
              ))
            )}
          </ul>
        </article>
      </div>
    </section>
  );
}
