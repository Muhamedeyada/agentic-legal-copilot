import { useState } from "react";
import type { WorkflowSnapshot } from "../api/types";
import type { copy, UiLocale } from "../copy";

type T = (typeof copy)[UiLocale];

export function TraceDrawer({ t, snapshot }: { t: T; snapshot: WorkflowSnapshot | null }) {
  const [open, setOpen] = useState(false);
  const traces = snapshot?.traces ?? [];
  const tools = traces.filter((tr) => tr.toolName);
  const latency = traces.reduce((sum, tr) => sum + tr.latencyMs, 0);
  const tokens = (snapshot?.tokenUsage.promptTokens ?? 0) + (snapshot?.tokenUsage.completionTokens ?? 0);

  return (
    <footer className="z-20 shrink-0 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_-16px_rgba(15,23,42,0.25)] backdrop-blur">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-[12px] font-semibold text-slate-900">{t.trace}</span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-slate-500">
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
        <div className="max-h-52 overflow-y-auto border-t border-slate-200 px-4 py-3 text-sm">
          <ol className="space-y-2 font-mono text-[11px] text-slate-600">
            {traces.length === 0 ? (
              <li>{t.traceHint}</li>
            ) : (
              traces.map((tr, i) => (
                <li key={`${tr.at}-${i}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                  {tr.at} · {tr.step}
                  {tr.agentId ? ` · ${tr.agentId}` : ""}
                  {tr.toolName ? ` · ${tr.toolName}` : ""} · {tr.latencyMs}ms
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
