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
    <section className="border border-(--color-rule) bg-white">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-start text-sm font-semibold"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{t.trace}</span>
        <span className="text-xs font-normal text-stone-500">{t.traceHint}</span>
      </button>
      {open ? (
        <div className="border-t border-(--color-rule) px-4 py-3 text-sm">
          <p>
            {t.tokens}: {tokens} · {t.tools}: {tools.length} · {t.latency}: {latency}ms
          </p>
          <ol className="mt-3 max-h-64 space-y-2 overflow-auto font-mono text-xs">
            {traces.map((tr, i) => (
              <li key={`${tr.at}-${i}`} className="border border-(--color-rule) p-2">
                {tr.at} · {tr.step}
                {tr.agentId ? ` · ${tr.agentId}` : ""}
                {tr.toolName ? ` · ${tr.toolName}` : ""} · {tr.latencyMs}ms
                {tr.error ? ` · ${tr.error}` : ""}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
