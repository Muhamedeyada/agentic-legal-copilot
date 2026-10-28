import type { AgentId, ToolName, TokenUsage, WorkflowState } from "../../domain/entities/workflow.js";
import type { ExtractedClause } from "../../domain/entities/workflow.js";
import type { RiskFinding } from "../../domain/entities/risk.js";

export type WorkflowStreamEvent =
  | {
      readonly type: "AGENT_START";
      readonly runId: string;
      readonly at: string;
      readonly agentId: AgentId;
      readonly step: WorkflowState;
    }
  | {
      readonly type: "AGENT_DONE";
      readonly runId: string;
      readonly at: string;
      readonly agentId: AgentId;
      readonly step: WorkflowState;
      readonly latencyMs: number;
      readonly tokenUsage: TokenUsage;
      readonly totalTokenUsage: TokenUsage;
    }
  | {
      readonly type: "TOOL_EXEC";
      readonly runId: string;
      readonly at: string;
      readonly agentId: AgentId;
      readonly step: WorkflowState;
      readonly toolName: ToolName;
      readonly latencyMs: number;
      readonly error?: string;
    }
  | {
      /**
       * Memo text as the model writes it. Append `deltaText` to `field`; `reset: true` (with empty
       * `deltaText`) means discard what was streamed, because that turn's text will not be used.
       * The memo in the run snapshot stays authoritative once AWAITING_APPROVAL arrives.
       */
      readonly type: "TOKEN_CHUNK";
      readonly runId: string;
      readonly at: string;
      readonly agentId: "memo_drafter";
      readonly field: "bodyEn" | "bodyAr";
      readonly deltaText: string;
      readonly reset?: true;
    }
  | {
      readonly type: "CLAUSE_EXTRACTED";
      readonly runId: string;
      readonly at: string;
      readonly clause: ExtractedClause;
    }
  | {
      readonly type: "RISK_FOUND";
      readonly runId: string;
      readonly at: string;
      readonly finding: RiskFinding;
    }
  | {
      readonly type: "AWAITING_APPROVAL";
      readonly runId: string;
      readonly at: string;
      readonly tokenUsage: TokenUsage;
    }
  | {
      readonly type: "HITL_DECISION";
      readonly runId: string;
      readonly at: string;
      readonly decision: "approved" | "rejected" | "edited";
    }
  | {
      readonly type: "RUN_FAILED";
      readonly runId: string;
      readonly at: string;
      readonly message: string;
    }
  | {
      readonly type: "RUN_CANCELLED";
      readonly runId: string;
      readonly at: string;
    };

export type WorkflowEventListener = (event: WorkflowStreamEvent) => void;
