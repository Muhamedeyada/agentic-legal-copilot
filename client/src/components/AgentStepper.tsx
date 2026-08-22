import type { LiveProgress } from "../hooks/useWorkflowStream";
import type { copy, UiLocale } from "../copy";

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
    <section className="border border-(--color-rule) bg-white p-4" aria-live="polite">
      <h2 className="text-sm font-semibold">{t.stepper}</h2>
      {lastEvent ? <p className="mt-1 font-mono text-xs text-stone-500">{lastEvent}</p> : null}
      <ol className="mt-4 grid gap-2 sm:grid-cols-4">
        {steps.map((step, index) => {
          const status = progress[step.field];
          const active = status === "active" || status === "waiting";
          return (
            <li
              key={step.key}
              className={`border px-3 py-3 ${active ? "border-(--color-accent) bg-(--color-paper)" : "border-(--color-rule)"}`}
            >
              <p className="text-[10px] tracking-wide text-stone-500">{String(index + 1).padStart(2, "0")}</p>
              <p className="mt-1 text-sm font-medium">{labelFor(t, step.key)}</p>
              <p className="mt-2 text-xs text-stone-600">{statusLabel(t, status)}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
