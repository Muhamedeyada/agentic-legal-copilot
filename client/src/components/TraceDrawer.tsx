import { useState } from "react";
import { focusRing } from "./ui";
import type { WorkflowSnapshot } from "../api/types";
import type { copy, UiLocale } from "../copy";

type T = (typeof copy)[UiLocale];

export function TraceDrawer({
  t,
  snapshot,
  liveTokens = 0,
}: {
  t: T;
  snapshot: WorkflowSnapshot | null;
  liveTokens?: number;
}) {
  const [open, setOpen] = useState(false);
  const traces = snapshot?.traces ?? [];
  const tools = traces.filter((tr) => tr.toolName);
  const latency = traces.reduce((sum, tr) => sum + tr.latencyMs, 0);
  const tokens = snapshot
    ? snapshot.tokenUsage.promptTokens + snapshot.tokenUsage.completionTokens
    : liveTokens;

  return (
    <footer className="z-20 shrink-0 border-t border-line bg-surface/95 shadow-[0_-8px_24px_-16px_rgba(15,23,42,0.25)] backdrop-blur">
      <button
        type="button"
        className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start select-none hover:bg-surface-muted focus-visible:ring-inset ${focusRing}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-[12px] font-semibold text-ink">{t.trace}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
          <span>
            {t.runId}: {snapshot?.runId ?? "—"}
          </span>
          <span>
            {t.tokens}: {tokens}
          </span>
          <span>
            {t.tools}: {tools.length}
          </span>
          <span>
            {t.latency}: {latency}ms
          </span>
        </span>
      </button>
      {open ? (
        <div className="max-h-52 overflow-y-auto border-t border-line px-4 py-3 text-sm">
          <ol className="space-y-2 font-mono text-[11px] text-body">
            {traces.length === 0 ? (
              <li>{t.traceHint}</li>
            ) : (
              traces.map((tr, i) => (
                <li key={`${tr.at}-${i}`} className="rounded-lg border border-line bg-surface-muted px-2.5 py-2">
                  {tr.at} · {tr.step}
                  {tr.agentId ? ` · ${tr.agentId}` : ""}
                  {tr.toolName ? ` · ${tr.toolName}` : ""} · {tr.latencyMs}ms
                  {tr.tokenUsage
                    ? ` · ${tr.tokenUsage.promptTokens}+${tr.tokenUsage.completionTokens} ${t.tokens}`
                    : ""}
                  {tr.error ? ` · ${tr.error}` : ""}
                </li>
              ))
            )}
          </ol>
        </div>
      ) : null}
    </footer>
  );
}
