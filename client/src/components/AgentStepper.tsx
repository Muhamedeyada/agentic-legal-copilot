import type { LiveProgress } from "../hooks/useWorkflowStream";
import type { copy, UiLocale } from "../copy";
import { Card, PaneTitle } from "./ui";

type T = (typeof copy)[UiLocale];

const steps = [
  { key: "extract", field: "extract" as const },
  { key: "risk", field: "risk" as const },
  { key: "memo", field: "memo" as const },
  { key: "gate", field: "gate" as const },
] as const;

function labelFor(t: T, key: (typeof steps)[number]["key"]): string {
  if (key === "extract") return t.extract;
  if (key === "risk") return t.risk;
  if (key === "memo") return t.memo;
  return t.gate;
}

function statusLabel(t: T, status: string): string {
  if (status === "active") return t.active;
  if (status === "done") return t.done;
  if (status === "waiting") return t.waiting;
  return t.idle;
}

type StepTone = "idle" | "active" | "done" | "gate";

function stepTone(status: string): StepTone {
  if (status === "done") return "done";
  if (status === "waiting") return "gate";
  if (status === "active") return "active";
  return "idle";
}

// Light-mode text uses -700 shades: emerald-600 / amber-600 on their -50 tints miss WCAG AA (3.5 / 3.1).
const dotClass: Record<StepTone, string> = {
  idle: "bg-surface-sunken text-body",
  active: "step-pulse bg-indigo-600 text-white ring-4 ring-indigo-500/20 dark:ring-indigo-400/25",
  done: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-800/70",
  gate: "bg-amber-50 text-amber-700 ring-2 ring-amber-300 dark:bg-amber-950/40 dark:text-amber-400 dark:ring-amber-700/70",
};

const connectorClass: Record<StepTone, string> = {
  idle: "bg-line",
  active: "bg-indigo-300 dark:bg-indigo-700",
  done: "bg-emerald-300 dark:bg-emerald-800",
  gate: "bg-amber-300 dark:bg-amber-700",
};

const labelClass: Record<StepTone, string> = {
  idle: "text-muted",
  active: "font-semibold text-indigo-700 dark:text-indigo-300",
  done: "text-emerald-700 dark:text-emerald-400",
  gate: "font-semibold text-amber-700 dark:text-amber-400",
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
    <Card aria-live="polite" aria-busy={streaming}>
      <PaneTitle hint={lastEvent ?? undefined}>{t.pipeline}</PaneTitle>
      {streaming ? (
        <div className="skeleton-bar mt-3" aria-hidden="true">
          <span className="skeleton-bar-fill" />
        </div>
      ) : null}
      <ol className="mt-4 flex items-start gap-1">
        {steps.map((step, index) => {
          const status = progress[step.field];
          const tone = stepTone(status);
          return (
            <li key={step.key} className="flex min-w-0 flex-1 items-start">
              {index > 0 ? <div className={`mt-3.5 h-px w-2 shrink-0 sm:w-4 ${connectorClass[tone]}`} /> : null}
              <div className="min-w-0 flex-1 text-center">
                <span
                  className={`mx-auto grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold transition-colors duration-300 ${dotClass[tone]}`}
                >
                  {tone === "done" ? <CheckIcon /> : String(index + 1).padStart(2, "0")}
                </span>
                <p className="mt-2 text-[11px] font-semibold leading-tight text-ink">{labelFor(t, step.key)}</p>
                <p className={`mt-1 text-[10px] ${labelClass[tone]}`}>{statusLabel(t, status)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
