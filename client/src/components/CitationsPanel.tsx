import type { Citation, RagCitation } from "../api/types";
import type { copy, UiLocale } from "../copy";

type T = (typeof copy)[UiLocale];

export function CitationsPanel({
  t,
  memoCitations,
  ragCitations,
}: {
  t: T;
  memoCitations: readonly Citation[];
  ragCitations: readonly RagCitation[];
}) {
  const empty = memoCitations.length === 0 && ragCitations.length === 0;
  return (
    <section className="border border-(--color-rule) bg-white p-4">
      <h2 className="text-sm font-semibold">{t.citations}</h2>
      {empty ? <p className="mt-2 text-sm text-stone-600">{t.noCitations}</p> : null}
      <ul className="mt-3 space-y-2">
        {memoCitations.map((c) => (
          <li key={`m-${c.id}`} className="border border-(--color-rule) p-3 text-sm">
            <p className="font-mono text-xs">{c.id}</p>
            <p className="mt-1 text-xs text-stone-500">
              {c.source} · {c.locator} · {c.language}
            </p>
            <p className="mt-2 leading-relaxed">{c.excerpt}</p>
          </li>
        ))}
        {ragCitations.map((c) => (
          <li key={`r-${c.chunkId}`} className="border border-(--color-rule) p-3 text-sm">
            <p className="font-mono text-xs">{c.chunkId}</p>
            <p className="mt-1 text-xs text-stone-500">
              {c.source} · {c.locator} · {c.language} · {(c.score * 100).toFixed(0)}%
            </p>
            <p className="mt-2 leading-relaxed">{c.excerpt}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
