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
  uploadContractFile,
  UploadError,
} from "./api/client";
import type { ContractRecord, ContractSummary, RagAnswer, WorkflowSnapshot } from "./api/types";
import { useWorkflowStream } from "./hooks/useWorkflowStream";
import { CitationFocusProvider } from "./citation-focus";
import { DocumentNavigator } from "./components/DocumentNavigator";
import { DocumentCanvas } from "./components/DocumentCanvas";
import { AgentStepper } from "./components/AgentStepper";
import { RiskBoard } from "./components/RiskBoard";
import { CounselGate } from "./components/CounselGate";
import { ApprovalBar } from "./components/ApprovalBar";
import { CitationsPanel } from "./components/CitationsPanel";
import { TraceDrawer } from "./components/TraceDrawer";
import { RagChat } from "./components/RagChat";
import { PlaybookInspectorHost } from "./components/PlaybookInspectorHost";
import { ThemeToggle } from "./components/ThemeToggle";
import { Toast } from "./components/Toast";
import { pressable } from "./components/ui";

type RightTab = "risks" | "memo" | "chat" | "trace";

export default function App() {
  const { locale, setLocale } = useLocale();
  const t = copy[locale];
  const [health, setHealth] = useState<boolean | null>(null);
  const [items, setItems] = useState<ContractSummary[]>([]);
  const [selected, setSelected] = useState<ContractRecord | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [ragBusy, setRagBusy] = useState(false);
  const [rag, setRag] = useState<RagAnswer | null>(null);
  const [memoDraft, setMemoDraft] = useState("");
  const [draftPulse, setDraftPulse] = useState(0);
  const [counselId, setCounselId] = useState("counsel-1");
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("risks");
  const { snapshot, setSnapshot, clauses, findings, progress, lastEvent, liveTokens } = useWorkflowStream(runId);

  const liveClauses = snapshot?.clauses.length ? snapshot.clauses : clauses;
  const liveFindings = snapshot?.findings.length ? snapshot.findings : findings;
  const tokens = snapshot ? snapshot.tokenUsage.promptTokens + snapshot.tokenUsage.completionTokens : liveTokens;
  const streaming = progress.extract === "active" || progress.risk === "active" || progress.memo === "active";

  const refreshList = useCallback(async () => {
    setItems(await listContracts());
  }, []);

  useEffect(() => {
    void fetchHealth().then(setHealth);
    void refreshList().catch(() => setHealth(false));
  }, [refreshList]);

  useEffect(() => {
    if (progress.gate === "waiting") setRightTab("memo");
  }, [progress.gate]);

  function resetRun(): void {
    setRunId(null);
    setRag(null);
    setMemoDraft("");
    setReason("");
  }

  async function handleSelect(id: string): Promise<void> {
    setSelected(await getContract(id));
    resetRun();
  }

  async function handleUpload(file: File): Promise<void> {
    try {
      const record = await uploadContractFile(file);
      await refreshList();
      setSelected(record);
      resetRun();
      const redacted = (record.redactions ?? []).reduce((sum, r) => sum + r.count, 0);
      if (redacted > 0) setToast(t.redactedToast.replace("{n}", String(redacted)));
    } catch (err) {
      const status = err instanceof UploadError ? err.status : 0;
      setToast(
        status === 413 ? t.uploadTooLarge : status === 415 ? t.dropInvalid : status === 422 ? t.uploadUnreadable : t.uploadFailed,
      );
    }
  }

  async function handleRun(): Promise<void> {
    if (!selected) return;
    setBusy(true);
    setRightTab("risks");
    try {
      const started = await startWorkflow({ contractId: selected.id, language: selected.language, text: selected.text });
      setMemoDraft("");
      setReason("");
      setRunId(started.runId);
    } finally {
      setBusy(false);
    }
  }

  async function decide(action: () => Promise<WorkflowSnapshot>, success: string): Promise<void> {
    setDeciding(true);
    try {
      setSnapshot(await action());
      setToast(success);
    } catch {
      setToast(t.actionFailed);
    } finally {
      setDeciding(false);
    }
  }

  const statusLabel = useMemo(() => {
    if (health === true) return t.healthOk;
    if (health === false) return t.healthFail;
    return "…";
  }, [health, t.healthFail, t.healthOk]);

  const applyPlaybookToMemo = useCallback(
    (block: string): "applied" | "duplicate" => {
      if (memoDraft.includes(block.trim())) return "duplicate";
      setMemoDraft((prev) => (prev.trim().length === 0 ? block : `${prev.replace(/\s+$/u, "")}\n\n${block}`));
      setDraftPulse((n) => n + 1);
      setRightTab("memo");
      window.requestAnimationFrame(() => {
        document.getElementById("counsel-memo-draft")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      });
      return "applied";
    },
    [memoDraft],
  );

  const memoCitations = snapshot?.memo?.citations ?? [];
  const ragCitations = rag?.citations ?? [];
  const tabs: ReadonlyArray<{ id: RightTab; label: string; badge?: number; pulse?: boolean }> = [
    { id: "risks", label: t.riskTab, ...(liveFindings.length > 0 ? { badge: liveFindings.length } : {}) },
    { id: "memo", label: t.memoTitle, pulse: progress.gate === "waiting" },
    { id: "chat", label: t.rag },
    { id: "trace", label: t.trace },
  ];

  return (
    <CitationFocusProvider clauses={liveClauses}>
      <PlaybookInspectorHost t={t} locale={locale} clauses={liveClauses} onApplyToMemo={applyPlaybookToMemo}>
        <div className="app-shell print:hidden">
          <header className="ws-header">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="ws-logo-badge" aria-hidden="true">
                D1
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] leading-tight font-semibold tracking-tight text-white">{t.product}</p>
                <p className="truncate text-[10px] leading-tight text-slate-400" dir="rtl">
                  {t.productAr}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300"
                aria-live="polite"
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    health === true ? "status-pulse bg-emerald-400" : health === false ? "bg-rose-400" : "bg-slate-500"
                  }`}
                />
                {statusLabel}
              </span>
              <div className="flex rounded-full bg-slate-800 p-0.5 text-[11px] font-semibold">
                {(["en", "ar"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    aria-pressed={locale === lang}
                    className={`rounded-full px-2.5 py-1 ${pressable} ${
                      locale === lang ? "bg-white text-slate-900" : "text-slate-300 hover:bg-slate-700 hover:text-white"
                    }`}
                    onClick={() => setLocale(lang)}
                  >
                    {lang === "en" ? t.langEn : t.langAr}
                  </button>
                ))}
              </div>
              <ThemeToggle toDarkLabel={t.themeToDark} toLightLabel={t.themeToLight} />
              <button
                type="button"
                disabled={!selected || busy}
                className={`rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm enabled:hover:bg-indigo-500 disabled:opacity-40 ${pressable}`}
                onClick={() => void handleRun()}
              >
                {busy ? t.running : t.runReview}
              </button>
              {runId && streaming ? (
                <button
                  type="button"
                  className={`rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-300 hover:border-white/30 hover:text-white ${pressable}`}
                  onClick={() => void cancelRun(runId)}
                >
                  {t.cancel}
                </button>
              ) : null}
            </div>
          </header>

          <div className="ws-body">
            <aside className="ws-pane-left" aria-label={t.explorer}>
              <DocumentNavigator
                t={t}
                items={items}
                selected={selected}
                clauses={liveClauses}
                findings={liveFindings}
                loadingList={health === null && items.length === 0}
                loadingClauses={progress.extract === "active" && liveClauses.length === 0}
                onSelect={(id) => void handleSelect(id)}
                onUpload={(file) => void handleUpload(file)}
              />
            </aside>

            <main className="ws-pane-center" aria-label={t.documentView}>
              <DocumentCanvas
                t={t}
                locale={locale}
                selected={selected}
                clauses={liveClauses}
                findings={liveFindings}
                streaming={streaming}
              />
            </main>

            <aside className="ws-pane-right" aria-label={t.counselDesk}>
              <div className="shrink-0 border-b border-divider">
                <AgentStepper t={t} progress={progress} lastEvent={lastEvent} tokens={tokens} />
              </div>

              <div className="copilot-tabs shrink-0" role="tablist" aria-label={t.counselDesk}>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`tab-${tab.id}`}
                    aria-selected={rightTab === tab.id}
                    aria-controls="copilot-panel"
                    className="copilot-tab"
                    onClick={() => setRightTab(tab.id)}
                  >
                    {tab.label}
                    {tab.badge ? <span className="ms-1 tabular-nums opacity-70">{tab.badge}</span> : null}
                    {tab.pulse ? <span className="status-pulse ms-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" /> : null}
                  </button>
                ))}
              </div>

              <div id="copilot-panel" className="ws-pane-scroll" role="tabpanel" aria-labelledby={`tab-${rightTab}`}>
                {rightTab === "risks" ? (
                  <RiskBoard t={t} findings={liveFindings} loading={progress.risk === "active"} />
                ) : rightTab === "memo" ? (
                  <div className="p-3">
                    <CounselGate
                      t={t}
                      locale={locale}
                      snapshot={snapshot}
                      contractTitle={selected?.title ?? snapshot?.contractId ?? "contract"}
                      findings={liveFindings}
                      drafting={progress.memo === "active"}
                      draft={memoDraft}
                      onDraftChange={setMemoDraft}
                      draftPulse={draftPulse}
                      counselId={counselId}
                      onCounselIdChange={setCounselId}
                    />
                  </div>
                ) : rightTab === "chat" ? (
                  <div className="space-y-3 p-3">
                    <RagChat
                      t={t}
                      locale={locale}
                      {...(selected ? { documentId: selected.id } : {})}
                      result={rag}
                      busy={ragBusy}
                      onAsk={(query) => {
                        setRagBusy(true);
                        void askRag({ query, language: locale, ...(selected ? { documentId: selected.id } : {}) })
                          .then(setRag)
                          .catch(() => setToast(t.actionFailed))
                          .finally(() => setRagBusy(false));
                      }}
                    />
                    <CitationsPanel t={t} memoCitations={memoCitations} ragCitations={ragCitations} />
                  </div>
                ) : (
                  <TraceDrawer t={t} snapshot={snapshot} liveTokens={liveTokens} inline />
                )}
              </div>

              {runId ? (
                <ApprovalBar
                  t={t}
                  snapshot={snapshot}
                  busy={deciding}
                  draft={memoDraft}
                  reason={reason}
                  onReasonChange={setReason}
                  onApprove={() => void decide(() => approveRun(runId, counselId), t.approvedToast)}
                  onReject={() => void decide(() => rejectRun(runId, reason, counselId), t.rejectedToast)}
                  onEditApprove={() =>
                    void decide(
                      () => editAndApproveRun(runId, counselId, locale === "ar" ? { bodyAr: memoDraft } : { bodyEn: memoDraft }),
                      t.editedToast,
                    )
                  }
                />
              ) : null}
            </aside>
          </div>
        </div>
        {toast ? <Toast message={toast} onDone={() => setToast(null)} /> : null}
      </PlaybookInspectorHost>
    </CitationFocusProvider>
  );
}
