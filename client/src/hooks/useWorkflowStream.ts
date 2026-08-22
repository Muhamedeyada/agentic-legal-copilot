import { useEffect, useRef, useState } from "react";
import { getRun, workflowStreamUrl } from "../api/client";
import type { ExtractedClause, RiskFinding, StreamEvent, WorkflowSnapshot } from "../api/types";

export interface LiveProgress {
  extract: "idle" | "active" | "done";
  risk: "idle" | "active" | "done";
  memo: "idle" | "active" | "done";
  gate: "idle" | "waiting" | "done";
}

const idleProgress: LiveProgress = {
  extract: "idle",
  risk: "idle",
  memo: "idle",
  gate: "idle",
};

export function useWorkflowStream(runId: string | null) {
  const [snapshot, setSnapshot] = useState<WorkflowSnapshot | null>(null);
  const [clauses, setClauses] = useState<ExtractedClause[]>([]);
  const [findings, setFindings] = useState<RiskFinding[]>([]);
  const [progress, setProgress] = useState<LiveProgress>(idleProgress);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!runId) {
      setSnapshot(null);
      setClauses([]);
      setFindings([]);
      setProgress(idleProgress);
      setLastEvent(null);
      return;
    }

    const apply = (event: StreamEvent): void => {
      setLastEvent(event.type);
      if (event.type === "AGENT_START" && event.agentId === "clause_extractor") {
        setProgress((p) => ({ ...p, extract: "active" }));
      }
      if (event.type === "AGENT_START" && event.agentId === "risk_assessor") {
        setProgress((p) => ({ ...p, extract: "done", risk: "active" }));
      }
      if (event.type === "AGENT_START" && event.agentId === "memo_drafter") {
        setProgress((p) => ({ ...p, risk: "done", memo: "active" }));
      }
      if (event.type === "CLAUSE_EXTRACTED" && event.clause) {
        const clause = event.clause;
        setClauses((prev) => (prev.some((c) => c.id === clause.id) ? prev : [...prev, clause]));
      }
      if (event.type === "RISK_FOUND" && event.finding) {
        const finding = event.finding;
        setFindings((prev) => (prev.some((f) => f.id === finding.id) ? prev : [...prev, finding]));
      }
      if (event.type === "AWAITING_APPROVAL") {
        setProgress({ extract: "done", risk: "done", memo: "done", gate: "waiting" });
        void getRun(runId).then(setSnapshot);
      }
      if (event.type === "HITL_DECISION") {
        setProgress({ extract: "done", risk: "done", memo: "done", gate: "done" });
        void getRun(runId).then(setSnapshot);
      }
      if (event.type === "RUN_FAILED" || event.type === "RUN_CANCELLED") {
        void getRun(runId).then(setSnapshot);
      }
    };

    const source = new EventSource(workflowStreamUrl(runId));
    sourceRef.current = source;
    const types: StreamEvent["type"][] = [
      "AGENT_START",
      "TOOL_EXEC",
      "CLAUSE_EXTRACTED",
      "RISK_FOUND",
      "AWAITING_APPROVAL",
      "HITL_DECISION",
      "RUN_FAILED",
      "RUN_CANCELLED",
    ];
    for (const type of types) {
      source.addEventListener(type, (msg: MessageEvent<string>) => {
        try {
          apply(JSON.parse(msg.data) as StreamEvent);
        } catch {
          setStreamError("Malformed SSE payload");
        }
      });
    }
    source.onerror = () => {
      setStreamError("stream");
    };

    return () => {
      source.close();
      sourceRef.current = null;
    };
  }, [runId]);

  return { snapshot, setSnapshot, clauses, findings, progress, lastEvent, streamError };
}
