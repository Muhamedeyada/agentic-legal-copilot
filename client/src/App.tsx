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
import { ContractPane } from "./components/ContractPane";
import { AgentStepper } from "./components/AgentStepper";
import { RiskPanel } from "./components/RiskPanel";
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
    <div className="mx-auto min-h-dvh max-w-7xl px-4 py-6 md:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-(--color-rule) pb-5">
        <div>
          <p className="text-xs font-medium tracking-wide text-(--color-accent)">{t.variant}</p>
          <h1 className="mt-2 text-3xl font-semibold">{t.product}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone-700">{t.intro}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-stone-600" aria-live="polite">
            {statusLabel}
          </p>
          <button
            type="button"
            className="rounded border border-(--color-ink) px-3 py-1.5 text-sm"
            onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
          >
            {t.toggle}
          </button>
          <button
            type="button"
            disabled={!selected || busy}
            className="rounded bg-(--color-accent) px-4 py-2 text-sm text-white disabled:opacity-40"
            onClick={() => void handleRun()}
          >
            {busy ? t.running : t.runReview}
          </button>
          {runId ? (
            <button
              type="button"
              className="rounded border border-(--color-rule) px-3 py-2 text-sm"
              onClick={() => {
                void cancelRun(runId);
              }}
            >
              {t.cancel}
            </button>
          ) : null}
        </div>
      </header>

      <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <ContractPane
          t={t}
          locale={locale}
          items={items}
          selected={selected}
          clauses={liveClauses}
          onSelect={(id) => void handleSelect(id)}
          onUpload={(file) => void handleUpload(file)}
        />
        <div className="flex flex-col gap-4">
          <AgentStepper t={t} progress={progress} lastEvent={lastEvent} />
          <RiskPanel t={t} findings={liveFindings} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <CounselGate
          t={t}
          locale={locale}
          snapshot={snapshot}
          busy={busy}
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
        <div className="flex flex-col gap-4">
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

      <div className="mt-4">
        <TraceDrawer t={t} snapshot={snapshot} />
      </div>
    </div>
  );
}
