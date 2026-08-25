import type { LiveProgress } from "../hooks/useWorkflowStream";
import type { copy, UiLocale } from "../copy";
import { Card, PaneTitle } from "./ui";

type T = (typeof copy)[UiLocale];
type StepKey = "extract" | "risk" | "memo" | "gate";
type StepStatus = LiveProgress[StepKey];
type ConnectorTone = "idle" | "run" | "done" | "wait";

const steps = [
  { key: "extract" as const, index: "01" },
  { key: "risk" as const, index: "02" },
  { key: "memo" as const, index: "03" },
  { key: "gate" as const, index: "04" },
];

function labelFor(t: T, key: StepKey): string {
  if (key === "extract") return t.extract;
  if (key === "risk") return t.risk;
  if (key === "memo") return t.memo;
  return t.gate;
}

function pendingFor(t: T, key: StepKey): string {
  if (key === "extract") return t.extractPending;
  if (key === "risk") return t.riskPending;
  if (key === "memo") return t.memoPending;
  return t.gatePending;
}

function withCount(template: string, n: number): string {
  return template.replace("{n}", String(n));
}

function contextFor(t: T, key: StepKey, status: StepStatus, clauseCount: number, findingCount: number): string {
  if (status === "active") return t.analyzing;
  if (status === "waiting") return t.gateOutput;
  if (status !== "done") return pendingFor(t, key);
  if (key === "extract") return withCount(t.extractOutput, clauseCount);
  if (key === "risk") return withCount(t.riskOutput, findingCount);
  if (key === "memo") return t.memoOutput;
  return t.gateDecided;
}

function liveEventLabel(type: string | null, t: T): string | undefined {
  if (!type) return undefined;
  if (type === "AGENT_START") return t.liveAgentStart;
  if (type === "CLAUSE_EXTRACTED") return t.liveClause;
  if (type === "RISK_FOUND") return t.liveRisk;
  if (type === "AWAITING_APPROVAL") return t.liveAwaiting;
  if (type === "HITL_DECISION") return t.liveDecision;
  if (type === "TOOL_EXEC") return t.liveTool;
  return type;
}

function connectorTone(next: StepStatus): ConnectorTone {
  if (next === "active") return "run";
  if (next === "waiting") return "wait";
  if (next === "done") return "done";
  return "idle";
}

function HollowMark() {
  return (
    <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-slate-300 bg-white" aria-hidden="true">
      <span className="h-2 w-2 rounded-full bg-slate-300" />
    </span>
  );
}

function SpinnerMark() {
  return (
    <span className="relative grid h-8 w-8 place-items-center" aria-hidden="true">
      <span className="absolute inset-0 rounded-full bg-indigo-400/35 animate-pulse" />
      <svg className="pipeline-spin relative h-8 w-8 text-indigo-600" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2.4" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function CheckMark() {
  return (
    <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500 text-white shadow-sm" aria-hidden="true">
      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none">
        <path d="M5 10.5 8.2 13.5 15 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function ShieldMark() {
  return (
    <span className="grid h-8 w-8 place-items-center rounded-full bg-amber-400 text-amber-950 shadow-sm" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
        <path d="M12 2.5 4.75 5.4v6.05c0 4.66 3.16 8.86 7.25 10.05 4.09-1.19 7.25-5.39 7.25-10.05V5.4L12 2.5Zm0 10.75h.01v.01H12v-.01Zm-.9-5.15h1.8v4.1h-1.8V8.1Z" />
      </svg>
    </span>
  );
}

function Connector({ lit, tone }: { lit: boolean; tone: ConnectorTone }) {
  return (
    <div className={`pipeline-connector ${lit ? `is-${tone}` : ""}`} aria-hidden="true">
      <span className="pipeline-rail" />
      <span className="pipeline-chevron" />
    </div>
  );
}

export function AgentStepper({
  t,
  progress,
  lastEvent,
  clauseCount,
  findingCount,
}: {
  t: T;
  progress: LiveProgress;
  lastEvent: string | null;
  clauseCount: number;
  findingCount: number;
}) {
  const streaming = progress.extract === "active" || progress.risk === "active" || progress.memo === "active";
  const eventHint = liveEventLabel(lastEvent, t);

  return (
    <Card className="pipeline-board" aria-live="polite" aria-busy={streaming}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <PaneTitle>{t.pipeline}</PaneTitle>
        {streaming || eventHint ? (
          <p className="flex items-center gap-2 text-[11px] font-medium text-slate-500">
            {streaming ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 status-pulse" />
                {t.pipelineLive}
              </span>
            ) : null}
            {eventHint ? <span className="max-w-[14rem] truncate">{eventHint}</span> : null}
          </p>
        ) : null}
      </div>
      {streaming ? (
        <div className="skeleton-bar mt-3" aria-hidden="true">
          <span className="skeleton-bar-fill" />
        </div>
      ) : null}
      <ol className="pipeline-track mt-4">
        {steps.map((step, index) => {
          const status = progress[step.key];
          const running = status === "active";
          const waiting = status === "waiting";
          const done = status === "done";
          const cardClass = waiting
            ? "bg-amber-50 border-amber-400 ring-2 ring-amber-300"
            : running
              ? "pipeline-card-run border-indigo-300 bg-indigo-50"
              : done
                ? "border-emerald-300 bg-emerald-50"
                : "border-slate-200 bg-white";
          const titleClass = running
            ? "text-indigo-950"
            : waiting
              ? "text-amber-950"
              : done
                ? "text-emerald-950"
                : "text-slate-400";
          const contextClass = running
            ? "text-indigo-700"
            : waiting
              ? "text-amber-800"
              : done
                ? "text-emerald-800"
                : "text-slate-400";

          return (
            <li key={step.key} className="pipeline-step">
              {index > 0 ? (
                <Connector lit={progress[steps[index - 1]!.key] === "done"} tone={connectorTone(status)} />
              ) : null}
              <article
                className={`flex min-w-0 flex-1 flex-col rounded-xl border p-3 transition-[border-color,background-color,box-shadow] duration-200 ${cardClass}`}
                aria-current={running || waiting ? "step" : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={`font-mono text-[10px] font-semibold tracking-[0.14em] ${done || running || waiting ? "text-current opacity-70" : "text-slate-400"}`}>
                    {step.index}
                  </span>
                  {waiting ? <ShieldMark /> : running ? <SpinnerMark /> : done ? <CheckMark /> : <HollowMark />}
                </div>
                <h3 className={`mt-3 text-sm font-semibold leading-snug ${titleClass}`}>{labelFor(t, step.key)}</h3>
                <p className={`mt-1 min-h-[2.5rem] text-[12px] leading-5 ${contextClass}`}>
                  {contextFor(t, step.key, status, clauseCount, findingCount)}
                </p>
                {running ? (
                  <span className="mt-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-800">
                    <span className="pipeline-spin inline-block h-2.5 w-2.5 rounded-full border border-indigo-500 border-t-transparent" />
                    {t.analyzing}
                  </span>
                ) : null}
                {done ? (
                  <span className="mt-auto inline-flex w-fit rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                    {t.completedBadge}
                  </span>
                ) : null}
                {waiting ? (
                  <span className="pipeline-blink mt-auto inline-flex w-fit items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-950">
                    {t.awaitingCounsel}
                  </span>
                ) : null}
                {!running && !done && !waiting ? (
                  <span className="mt-auto inline-flex w-fit rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    {t.idle}
                  </span>
                ) : null}
              </article>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
