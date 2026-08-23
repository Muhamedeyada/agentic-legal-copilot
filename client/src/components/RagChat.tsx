import { useState } from "react";
import type { RagAnswer } from "../api/types";
import type { copy, UiLocale } from "../copy";
import { CitationBadge } from "./CitationBadge";
import { Skeleton } from "./Skeleton";
import { Card, PaneTitle, fieldClass } from "./ui";

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
  const [open, setOpen] = useState(true);
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <PaneTitle hint={documentId}>{t.rag}</PaneTitle>
        <button
          type="button"
          className="text-[11px] font-semibold text-slate-500 hover:text-slate-900"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? t.ragCollapse : t.ragExpand}
        </button>
      </div>
      {open ? (
        <>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{t.ragHint}</p>
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
              className={`${fieldClass} mt-0 flex-1`}
              value={query}
              dir={locale === "ar" ? "rtl" : "ltr"}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t.rag}
            />
            <button
              type="submit"
              disabled={busy || query.trim().length === 0}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition duration-150 hover:bg-indigo-950 disabled:opacity-40"
            >
              {t.ask}
            </button>
          </form>
          {busy ? (
            <div className="mt-3 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : null}
          {result?.refused ? <p className="mt-3 text-sm text-rose-700">{t.refused}</p> : null}
          {result && !result.refused && !busy ? (
            <>
              <pre className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-800">
                {result.answer}
              </pre>
              {result.citations.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {result.citations.map((c, i) => (
                    <CitationBadge
                      key={c.chunkId}
                      index={i + 1}
                      label={c.locator || c.chunkId}
                      hint={c.excerpt.slice(0, 120)}
                      target={{
                        chunkId: c.chunkId,
                        documentId: c.documentId,
                        locator: c.locator,
                        excerpt: c.excerpt,
                        source: c.source,
                      }}
                    />
                  ))}
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}
