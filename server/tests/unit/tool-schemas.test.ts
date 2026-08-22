import { describe, expect, it } from "vitest";
import { SchemaViolationError, ToolNotAllowedError } from "../../src/domain/errors.js";
import { ToolRegistry } from "../../src/application/tools/registry.js";
import { createRetrievalTool } from "../../src/application/tools/retrieval.tool.js";
import { createClauseComparisonTool } from "../../src/application/tools/clause-comparison.tool.js";
import { createRiskCalculatorTool } from "../../src/application/tools/risk-calculator.tool.js";
import { createSaveDraftMemoTool } from "../../src/application/tools/save-draft-memo.tool.js";
import { InMemoryPlaybookAdapter } from "../../src/infrastructure/playbook/in-memory.adapter.js";
import { InMemoryRunStoreAdapter } from "../../src/infrastructure/runs/in-memory.adapter.js";
import {
  RetrievalToolInputZ,
  ClauseComparisonInputZ,
  parseContract,
} from "../../src/application/agents/schemas.js";

describe("tool schema contracts", () => {
  it("rejects empty retrieval queries", () => {
    expect(() => parseContract(RetrievalToolInputZ, "retrieval_tool.input", { query: "" })).toThrow(
      SchemaViolationError,
    );
  });

  it("rejects comparison input that is not two clause strings", () => {
    expect(() =>
      parseContract(ClauseComparisonInputZ, "clause_comparison_tool.input", {
        contractClause: "ok",
      }),
    ).toThrow(SchemaViolationError);
  });

  it("blocks the extractor from the write tool", async () => {
    const registry = new ToolRegistry();
    registry.register(createRetrievalTool({ playbook: new InMemoryPlaybookAdapter() }));
    registry.register(createClauseComparisonTool());
    registry.register(createRiskCalculatorTool());
    registry.register(createSaveDraftMemoTool({ runs: new InMemoryRunStoreAdapter() }));

    await expect(
      registry.invoke(
        "save_draft_memo_tool",
        {
          runId: "run-1",
          memo: {
            id: "m",
            contractId: "c",
            language: "en",
            citations: [],
            approvedByCounsel: false,
            bodyEn: "draft",
          },
        },
        { runId: "run-1", agentId: "clause_extractor", state: "DRAFTING" },
      ),
    ).rejects.toBeInstanceOf(ToolNotAllowedError);
  });
});
