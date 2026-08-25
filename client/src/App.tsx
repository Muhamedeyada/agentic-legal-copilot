import { useCallback, useEffect, useMemo, useState } from "react";
import { copy } from "./copy";
import { useLocale } from "./locale";
import {
  approveRun,
  askRag,
  cancelRun,
  editAndApproveRun,
  fetchHealth,
  getContract,
  listContracts,
  rejectRun,
  startWorkflow,
  uploadContract,
} from "./api/client";
import type { ContractRecord, ContractSummary, RagAnswer } from "./api/types";
import { useWorkflowStream } from "./hooks/useWorkflowStream";
import { CitationFocusProvider } from "./citation-focus";
import { ContractPane } from "./components/ContractPane";
import { AgentStepper } from "./components/AgentStepper";
import { RiskPanel } from "./components/RiskPanel";
import { RedlineViewer } from "./components/RedlineViewer";
import { CounselGate } from "./components/CounselGate";
import { CitationsPanel } from "./components/CitationsPanel";
import { TraceDrawer } from "./components/TraceDrawer";
import { RagChat } from "./components/RagChat";

export default function App() {
  const { locale, setLocale } = useLocale();
  const t = copy[locale];
  const [health, setHealth] = useState<boolean | null>(null);
  const [items, setItems] = useState<ContractSummary[]>([]);
  const [selected, setSelected] = useState<ContractRecord | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ragBusy, setRagBusy] = useState(false);
  const [rag, setRag] = useState<RagAnswer | null>(null);
  const { snapshot, setSnapshot, clauses, findings, progress, lastEvent } = useWorkflowStream(runId);

  const liveClauses = snapshot?.clauses.length ? snapshot.clauses : clauses;
  const liveFindings = snapshot?.findings.length ? snapshot.findings : findings;

  const refreshList = useCallback(async () => {
    const next = await listContracts();
    setItems(next);
  }, []);

  useEffect(() => {
    void fetchHealth().then(setHealth);
    void refreshList().catch(() => setHealth(false));
  }, [refreshList]);

  async function handleSelect(id: string): Promise<void> {
    const doc = await getContract(id);
    setSelected(doc);
    setRunId(null);
    setRag(null);
  }

  async function handleUpload(file: File): Promise<void> {
    const text = await file.text();
    const language = /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
    const record = await uploadContract({ title: file.name, language, text });
    await refreshList();
    setSelected(record);
    setRunId(null);
  }

  async function handleRun(): Promise<void> {
    if (!selected) {
      return;
    }
    setBusy(true);
    try {
      const started = await startWorkflow({
        contractId: selected.id,
        language: selected.language,
        text: selected.text,
      });
      setRunId(started.runId);
    } finally {
      setBusy(false);
    }
  }

  const memoCitations = snapshot?.memo?.citations ?? [];
  const ragCitations = rag?.citations ?? [];

  const statusLabel = useMemo(() => {
    if (health === true) return t.healthOk;
    if (health === false) return t.healthFail;
    return "…";
  }, [health, t.healthFail, t.healthOk]);

  return (
    <CitationFocusProvider clauses={liveClauses}>
      <div className="app-shell flex h-dvh flex-col overflow-hidden bg-slate-50 print:hidden">
        <header className="z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-2.5 text-white">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10 text-[11px] font-semibold tracking-wide">
              D1
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold tracking-tight">{t.product}</p>
              <p className="truncate text-[11px] text-slate-300" dir="rtl">
                {t.productAr}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-slate-200"
              aria-live="polite"
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  health === true ? "bg-emerald-400 status-pulse" : health === false ? "bg-rose-400" : "bg-slate-400"
                }`}
              />
              {statusLabel}
            </span>
            <div className="flex rounded-full bg-slate-800 p-0.5 text-[11px] font-medium">
              <button
                type="button"
                className={`rounded-full px-2.5 py-1 transition duration-150 ${
                  locale === "en" ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"
                }`}
                onClick={() => setLocale("en")}
              >
                {t.langEn}
              </button>
              <button
                type="button"
                className={`rounded-full px-2.5 py-1 transition duration-150 ${
                  locale === "ar" ? "bg-white text-slate-900" : "text-slate-300 hover:text-white"
                }`}
                onClick={() => setLocale("ar")}
              >
                {t.langAr}
              </button>
            </div>
            <button
              type="button"
              disabled={!selected || busy}
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition duration-150 hover:bg-slate-100 disabled:opacity-40"
              onClick={() => void handleRun()}
            >
              {busy ? t.running : t.runReview}
            </button>
            {runId ? (
              <button
                type="button"
                className="rounded-lg border border-white/20 px-3 py-2 text-sm text-slate-200 transition duration-150 hover:bg-white/10"
                onClick={() => {
                  void cancelRun(runId);
                }}
              >
                {t.cancel}
              </button>
            ) : null}
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto lg:overflow-hidden">
          <div className="mx-auto grid h-full max-w-[1680px] gap-4 p-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(0,0.95fr)]">
            <ContractPane
              t={t}
              locale={locale}
              items={items}
              selected={selected}
              clauses={liveClauses}
              findings={liveFindings}
              loadingList={health === null && items.length === 0}
              loadingClauses={progress.extract === "active" && liveClauses.length === 0}
              onSelect={(id) => void handleSelect(id)}
              onUpload={(file) => void handleUpload(file)}
            />
            <div className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto lg:pe-1">
              <AgentStepper t={t} progress={progress} lastEvent={lastEvent} />
              <RiskPanel t={t} findings={liveFindings} loading={progress.risk === "active"} />
              <RedlineViewer t={t} locale={locale} findings={liveFindings} clauses={liveClauses} />
            </div>
            <div className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto lg:pe-1">
              <CounselGate
                t={t}
                locale={locale}
                snapshot={snapshot}
                contractTitle={selected?.title ?? snapshot?.contractId ?? "contract"}
                findings={liveFindings}
                busy={busy}
                drafting={progress.memo === "active"}
                onApprove={(counselId) => {
                  if (!runId) return;
                  void approveRun(runId, counselId).then(setSnapshot);
                }}
                onReject={(counselId, reason) => {
                  if (!runId) return;
                  void rejectRun(runId, reason, counselId).then(setSnapshot);
                }}
                onEditApprove={(counselId, body) => {
                  if (!runId) return;
                  const edited = locale === "ar" ? { bodyAr: body } : { bodyEn: body };
                  void editAndApproveRun(runId, counselId, edited).then(setSnapshot);
                }}
              />
              <RagChat
                t={t}
                locale={locale}
                {...(selected ? { documentId: selected.id } : {})}
                result={rag}
                busy={ragBusy}
                onAsk={(query) => {
                  setRagBusy(true);
                  void askRag({
                    query,
                    language: locale,
                    ...(selected ? { documentId: selected.id } : {}),
                  })
                    .then(setRag)
                    .finally(() => setRagBusy(false));
                }}
              />
              <CitationsPanel t={t} memoCitations={memoCitations} ragCitations={ragCitations} />
            </div>
          </div>
        </main>

        <TraceDrawer t={t} snapshot={snapshot} />
      </div>
    </CitationFocusProvider>
  );
}
