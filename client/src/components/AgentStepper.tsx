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

export function AgentStepper({ t, progress, lastEvent }: { t: T; progress: LiveProgress; lastEvent: string | null }) {
  return (
    <Card aria-live="polite">
      <PaneTitle hint={lastEvent ?? undefined}>{t.pipeline}</PaneTitle>
      <ol className="mt-4 flex items-start gap-1">
        {steps.map((step, index) => {
          const status = progress[step.field];
          const active = status === "active" || status === "waiting";
          const done = status === "done";
          return (
            <li key={step.key} className="flex min-w-0 flex-1 items-start">
              {index > 0 ? (
                <div
                  className={`mt-3 h-px w-2 shrink-0 sm:w-4 ${done || active ? "bg-indigo-900" : "bg-slate-200"}`}
                />
              ) : null}
              <div className="min-w-0 flex-1 text-center">
                <span
                  className={`mx-auto grid h-7 w-7 place-items-center rounded-full text-[11px] font-semibold ${
                    done
                      ? "bg-slate-900 text-white"
                      : active
                        ? "bg-indigo-900 text-white step-pulse"
                        : "bg-slate-100 text-slate-500"
                  }`}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="mt-2 text-[11px] font-semibold leading-tight text-slate-900">
                  {labelFor(t, step.key)}
                </p>
                <p className="mt-1 text-[10px] text-slate-500">{statusLabel(t, status)}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
