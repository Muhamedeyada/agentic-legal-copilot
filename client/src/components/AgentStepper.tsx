import type { LiveProgress } from "../hooks/useWorkflowStream";
import type { copy, UiLocale } from "../copy";

type T = (typeof copy)[UiLocale];

const steps = [
  { key: "extract", field: "extract" as const },
  { key: "risk",    field: "risk"    as const },
  { key: "memo",    field: "memo"    as const },
  { key: "gate",    field: "gate"    as const },
] as const;

function labelFor(t: T, key: (typeof steps)[number]["key"]): string {
  if (key === "extract") return t.extract;
  if (key === "risk")    return t.risk;
  if (key === "memo")    return t.memo;
  return t.gate;
}

function statusLabel(t: T, status: string): string {
  if (status === "active")  return t.active;
  if (status === "done")    return t.done;
  if (status === "waiting") return t.waiting;
  return t.idle;
}

type StepTone = "idle" | "active" | "done" | "gate";

function stepTone(status: string): StepTone {
  if (status === "done")    return "done";
  if (status === "waiting") return "gate";
  if (status === "active")  return "active";
  return "idle";
}

const dotClass: Record<StepTone, string> = {
  idle:   "bg-surface-sunken text-muted",
  active: "step-pulse bg-indigo-600 text-white ring-4 ring-indigo-500/20 dark:ring-indigo-400/25",
  done:   "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-800/70",
  gate:   "bg-amber-50 text-amber-700 ring-2 ring-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-700/70",
};

const connectorClass: Record<StepTone, string> = {
  idle:   "bg-line",
  active: "bg-indigo-300 dark:bg-indigo-700",
  done:   "bg-emerald-300 dark:bg-emerald-800",
  gate:   "bg-amber-300 dark:bg-amber-700",
};

const labelClass: Record<StepTone, string> = {
  idle:   "text-muted",
  active: "font-semibold text-indigo-700 dark:text-indigo-300",
  done:   "text-emerald-700 dark:text-emerald-400",
  gate:   "font-semibold text-amber-700 dark:text-amber-400",
};

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

export function AgentStepper({ t, progress, lastEvent }: { t: T; progress: LiveProgress; lastEvent: string | null }) {
  const streaming = progress.extract === "active" || progress.risk === "active" || progress.memo === "active";

  return (
    <div className="p-3" aria-live="polite" aria-busy={streaming}>
      {/* Section label + live event hint */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-muted">{t.pipeline}</h2>
        {lastEvent ? (
          <span className="max-w-[12rem] truncate text-[10px] text-muted">{lastEvent}</span>
        ) : null}
      </div>

      {/* Streaming progress bar */}
      {streaming ? (
        <div className="skeleton-bar mb-3" aria-hidden="true">
          <span className="skeleton-bar-fill" />
        </div>
      ) : null}

      {/* Step breadcrumb */}
      <ol className="flex items-start gap-0.5">
        {steps.map((step, index) => {
          const status = progress[step.field];
          const tone = stepTone(status);
          return (
            <li key={step.key} className="flex min-w-0 flex-1 items-start">
              {index > 0 ? (
                <div className={`mt-3 h-px flex-1 ${connectorClass[tone]}`} />
              ) : null}
              <div className="min-w-0 flex-none text-center px-0.5">
                <span className={`mx-auto grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold transition-colors duration-300 ${dotClass[tone]}`}>
                  {tone === "done" ? <CheckIcon /> : String(index + 1)}
                </span>
                <p className="mt-1.5 text-[9px] font-semibold leading-tight text-ink px-0.5 whitespace-nowrap">{labelFor(t, step.key)}</p>
                <p className={`mt-0.5 text-[9px] leading-tight ${labelClass[tone]}`}>{statusLabel(t, status)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}