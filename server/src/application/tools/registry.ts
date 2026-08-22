import { z } from "zod";
import { ToolNotAllowedError } from "../../domain/errors.js";
import type { AgentId, ToolName, WorkflowState } from "../../domain/entities/workflow.js";
import { parseContract } from "../agents/schemas.js";

export interface ToolContext {
  readonly runId: string;
  readonly agentId: AgentId;
  readonly state: WorkflowState;
}

export interface ToolDefinition<I, O> {
  readonly name: ToolName;
  readonly inputSchema: z.ZodType<I>;
  readonly outputSchema: z.ZodType<O>;
  readonly sideEffecting: boolean;
  readonly execute: (input: I, ctx: ToolContext) => Promise<O>;
}

const ALLOWLIST: Record<AgentId, readonly ToolName[]> = {
  clause_extractor: ["retrieval_tool"],
  risk_assessor: ["retrieval_tool", "clause_comparison_tool", "risk_calculator_tool"],
  memo_drafter: ["retrieval_tool", "save_draft_memo_tool"],
};

export type ToolTraceListener = (event: {
  readonly toolName: ToolName;
  readonly agentId: AgentId;
  readonly state: WorkflowState;
  readonly input: unknown;
  readonly output: unknown;
  readonly latencyMs: number;
  readonly error?: string;
}) => void;

export class ToolRegistry {
  private readonly tools = new Map<ToolName, ToolDefinition<unknown, unknown>>();

  constructor(private readonly onTrace?: ToolTraceListener) {}

  register<I, O>(tool: ToolDefinition<I, O>): void {
    this.tools.set(tool.name, tool as ToolDefinition<unknown, unknown>);
  }

  allowed(agentId: AgentId, toolName: ToolName): boolean {
    return ALLOWLIST[agentId].includes(toolName);
  }

  async invoke<I, O>(
    toolName: ToolName,
    rawInput: unknown,
    ctx: ToolContext,
  ): Promise<O> {
    if (!this.allowed(ctx.agentId, toolName)) {
      throw new ToolNotAllowedError(ctx.agentId, toolName);
    }
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool ${toolName} is not registered.`);
    }
    if (tool.sideEffecting && ctx.state !== "DRAFTING") {
      throw new Error(`Side-effecting tool ${toolName} may only run during DRAFTING.`);
    }
    const input = parseContract(tool.inputSchema, `${toolName}.input`, rawInput);
    const started = Date.now();
    try {
      const output = await tool.execute(input, ctx);
      const parsed = parseContract(tool.outputSchema, `${toolName}.output`, output) as O;
      this.onTrace?.({
        toolName,
        agentId: ctx.agentId,
        state: ctx.state,
        input,
        output: parsed,
        latencyMs: Date.now() - started,
      });
      return parsed;
    } catch (err) {
      this.onTrace?.({
        toolName,
        agentId: ctx.agentId,
        state: ctx.state,
        input,
        output: {},
        latencyMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }
}

export { ALLOWLIST as AGENT_TOOL_ALLOWLIST };
