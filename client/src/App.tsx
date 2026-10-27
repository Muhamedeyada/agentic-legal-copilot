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
import { PlaybookInspectorHost } from "./components/PlaybookInspectorHost";
import { ThemeToggle } from "./components/ThemeToggle";
import { pressable } from "./components/ui";

type RightTab = "memo" | "chat" | "trace";

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
  const [memoDraft, setMemoDraft] = useState("");
  const [draftPulse, setDraftPulse] = useState(0);
  const [rightTab, setRightTab] = useState<RightTab>("memo");
  const { snapshot, setSnapshot, clauses, findings, progress, lastEvent, liveTokens } =
    useWorkflowStream(runId);

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
    setMemoDraft("");
  }

  async function handleUpload(file: File): Promise<void> {
    const text = await file.text();
    const language = /[\u0600-\u06FF]/.test(text) ? "ar" : "en";
    const record = await uploadContract({ title: file.name, language, text });
    await refreshList();
    setSelected(record);
    setRunId(null);
    setMemoDraft("");
  }

  async function handleRun(): Promise<void> {
    if (!selected) return;
    setBusy(true);
    setRightTab("memo");
    try {
      const started = await startWorkflow({
        contractId: selected.id,
        language: selected.language,
        text: selected.text,
      });
      setRunId(started.runId);
      setMemoDraft("");
    } finally {
      setBusy(false);
    }
  }

  const memoCitations = snapshot?.memo?.citations ?? [];
  const ragCitations = rag?.citations ?? [];

  const statusLabel = useMemo(() => {
    if (health === true) return t.healthOk;
    if (health === false) return t.healthFail;
    return "...";
  }, [health, t.healthFail, t.healthOk]);

  const applyPlaybookToMemo = useCallback(
    (block: string): "applied" | "duplicate" => {
      const trimmed = block.trim();
      if (memoDraft.includes(trimmed)) return "duplicate";
      setMemoDraft((prev) =>
        prev.trim().length === 0 ? block : `${prev.replace(/\s+$/u, "")}\n\n${block}`,
      );
      setDraftPulse((n) => n + 1);
      setRightTab("memo");
      window.requestAnimationFrame(() => {
        document.getElementById("counsel-memo-draft")?.scrollIntoView({
          block: "nearest",
          behavior: "smooth",
        });
      });
      return "applied";
    },
    [memoDraft],
  );

  useEffect(() => {
    if (progress.gate === "waiting") setRightTab("memo");
  }, [progress.gate]);

  const isStreaming =
    progress.extract === "active" ||
    progress.risk === "active" ||
    progress.memo === "active";

  return (
    <CitationFocusProvider clauses={liveClauses}>
      <PlaybookInspectorHost t={t} locale={locale} clauses={liveClauses} onApplyToMemo={applyPlaybookToMemo}>
        <div className="app-shell print:hidden">

          {/* TOP HEADER */}
          <header className="ws-header">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="ws-logo-badge" aria-hidden="true">D1</span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold tracking-tight text-white leading-tight">{t.product}</p>
                <p className="truncate text-[10px] text-slate-400 leading-tight" dir="rtl">{t.productAr}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-300" aria-live="polite">
                <span className={`h-1.5 w-1.5 rounded-full ${health === true ? "bg-emerald-400 status-pulse" : health === false ? "bg-rose-400" : "bg-slate-500"}`} />
                {statusLabel}
              </span>

              {(isStreaming || liveTokens > 0) ? (
                <span className="token-pill" aria-live="polite">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-400 status-pulse" />
                  {liveTokens.toLocaleString()} {t.tokens}
                </span>
              ) : null}

              <div className="flex rounded-full bg-slate-800/80 p-0.5 text-[11px] font-semibold">
                <button type="button" id="btn-lang-en" className={`rounded-full px-2.5 py-1 ${pressable} ${locale === "en" ? "bg-white text-slate-900" : "text-slate-400 hover:bg-slate-700 hover:text-white"}`} onClick={() => setLocale("en")}>{t.langEn}</button>
                <button type="button" id="btn-lang-ar" className={`rounded-full px-2.5 py-1 ${pressable} ${locale === "ar" ? "bg-white text-slate-900" : "text-slate-400 hover:bg-slate-700 hover:text-white"}`} onClick={() => setLocale("ar")}>{t.langAr}</button>
              </div>

              <ThemeToggle toDarkLabel={t.themeToDark} toLightLabel={t.themeToLight} />

              <button type="button" id="btn-run-review" disabled={!selected || busy} className={`rounded-lg bg-indigo-500 px-4 py-1.5 text-sm font-semibold text-white shadow-md shadow-indigo-900/30 enabled:hover:bg-indigo-400 disabled:opacity-40 ${pressable}`} onClick={() => void handleRun()}>
                {busy ? <span className="flex items-center gap-2"><span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden="true" />{t.running}</span> : t.runReview}
              </button>

              {runId ? (
                <button type="button" id="btn-cancel-run" className={`rounded-lg border border-white/15 px-3 py-1.5 text-sm text-slate-300 hover:border-white/30 hover:text-white ${pressable}`} onClick={() => { void cancelRun(runId); }}>{t.cancel}</button>
              ) : null}
            </div>
          </header>

          {/* 3-PANE WORKSPACE */}
          <div className="ws-body">

            {/* LEFT PANE */}
            <aside className="ws-pane-left" aria-label={t.explorer}>
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
            </aside>

            {/* CENTER PANE */}
            <main className="ws-pane-center" aria-label="Contract reading canvas">
              <div className="ws-section-header">
                <div className="flex min-w-0 items-center gap-2">
                  <svg className="h-3.5 w-3.5 shrink-0 text-muted" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" /></svg>
                  <span className="truncate text-xs font-semibold text-ink">{selected?.title ?? t.noContract}</span>
                  {selected ? <span className="meta-chip">{selected.language.toUpperCase()}</span> : null}
                  {selected?.contractType ? <span className="meta-chip">{selected.contractType}</span> : null}
                  {selected?.highRisk ? <span className="meta-chip" style={{ borderColor: "#fca5a5", color: "#be123c", background: "#fff1f2" }}>risk {t.highRisk}</span> : null}
                </div>
                {isStreaming ? (
                  <span className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                    <span className="inline-block h-2 w-2 rounded-full bg-indigo-500 status-pulse" />
                    {t.active}
                  </span>
                ) : null}
              </div>

              <div className="ws-pane-scroll">
                {liveFindings.length > 0 ? (
                  <div className="px-3 pt-3">
                    <RedlineViewer t={t} locale={locale} findings={liveFindings} clauses={liveClauses} />
                  </div>
                ) : null}
                <div className="doc-canvas">
                  <pre className="contract-body whitespace-pre-wrap text-ink" dir={selected?.language === "ar" || locale === "ar" ? "rtl" : "ltr"}>
                    {selected ? selected.text : <span className="text-sm text-muted">{t.noContract}</span>}
                  </pre>
                </div>
              </div>
            </main>

            {/* RIGHT PANE */}
            <aside className="ws-pane-right" aria-label={t.counselDesk}>
              <div className="border-b border-divider">
                <AgentStepper t={t} progress={progress} lastEvent={lastEvent} />
              </div>

              {(liveFindings.length > 0 || progress.risk === "active") ? (
                <div className="border-b border-divider">
                  <RiskPanel t={t} findings={liveFindings} loading={progress.risk === "active"} />
                </div>
              ) : null}

              <div className="copilot-tabs" role="tablist" aria-label="Copilot panel tabs">
                <button type="button" id="tab-memo" role="tab" aria-selected={rightTab === "memo"} className="copilot-tab" onClick={() => setRightTab("memo")}>
                  {t.memoTitle}
                  {progress.gate === "waiting" ? <span className="ms-1.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 status-pulse" /> : null}
                </button>
                <button type="button" id="tab-chat" role="tab" aria-selected={rightTab === "chat"} className="copilot-tab" onClick={() => setRightTab("chat")}>{t.rag}</button>
                <button type="button" id="tab-trace" role="tab" aria-selected={rightTab === "trace"} className="copilot-tab" onClick={() => setRightTab("trace")}>{t.trace}</button>
              </div>

              <div className="ws-pane-scroll" role="tabpanel">
                {rightTab === "memo" ? (
                  <div className="space-y-3 p-3">
                    <CounselGate
                      t={t}
                      locale={locale}
                      snapshot={snapshot}
                      contractTitle={selected?.title ?? snapshot?.contractId ?? "contract"}
                      findings={liveFindings}
                      busy={busy}
                      drafting={progress.memo === "active"}
                      draft={memoDraft}
                      onDraftChange={setMemoDraft}
                      draftPulse={draftPulse}
                      onApprove={(counselId) => { if (!runId) return; void approveRun(runId, counselId).then(setSnapshot); }}
                      onReject={(counselId, reason) => { if (!runId) return; void rejectRun(runId, reason, counselId).then(setSnapshot); }}
                      onEditApprove={(counselId, body) => { if (!runId) return; const edited = locale === "ar" ? { bodyAr: body } : { bodyEn: body }; void editAndApproveRun(runId, counselId, edited).then(setSnapshot); }}
                    />
                    {(memoCitations.length > 0 || ragCitations.length > 0) ? (
                      <CitationsPanel t={t} memoCitations={memoCitations} ragCitations={ragCitations} />
                    ) : null}
                  </div>
                ) : rightTab === "chat" ? (
                  <div className="p-3">
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
                          .finally(() => setRagBusy(false));
                      }}
                    />
                  </div>
                ) : (
                  <TraceDrawer t={t} snapshot={snapshot} liveTokens={liveTokens} inline />
                )}
              </div>
            </aside>
          </div>
        </div>
      </PlaybookInspectorHost>
    </CitationFocusProvider>
  );
}