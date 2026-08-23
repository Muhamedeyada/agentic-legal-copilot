import type { Citation, RagCitation } from "../api/types";
import type { copy, UiLocale } from "../copy";
import { CitationBadge } from "./CitationBadge";
import { Card, PaneTitle } from "./ui";

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
    <Card>
      <PaneTitle hint={t.citationHint}>{t.citations}</PaneTitle>
      {empty ? <p className="mt-2 text-sm text-slate-500">{t.noCitations}</p> : null}
      <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
        {memoCitations.map((c, i) => (
          <li key={`m-${c.id}`} className="rounded-lg border border-slate-200 p-3 text-sm">
            <CitationBadge
              index={i + 1}
              label={c.locator || c.id}
              hint={c.id}
              target={{ id: c.id, locator: c.locator, excerpt: c.excerpt, source: c.source }}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              {c.source} · {c.language}
            </p>
            <p className="mt-2 leading-relaxed text-slate-700">{c.excerpt}</p>
          </li>
        ))}
        {ragCitations.map((c, i) => (
          <li key={`r-${c.chunkId}`} className="rounded-lg border border-slate-200 p-3 text-sm">
            <CitationBadge
              index={memoCitations.length + i + 1}
              label={c.locator || c.chunkId}
              hint={c.chunkId}
              target={{
                chunkId: c.chunkId,
                documentId: c.documentId,
                locator: c.locator,
                excerpt: c.excerpt,
                source: c.source,
              }}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              {c.source} · {c.language} · {(c.score * 100).toFixed(0)}%
            </p>
            <p className="mt-2 leading-relaxed text-slate-700">{c.excerpt}</p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
