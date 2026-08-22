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
