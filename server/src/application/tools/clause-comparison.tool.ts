import { tokenOverlap } from "../../domain/retrieval/arabic-normalize.js";
import { ClauseComparisonInputZ, ClauseComparisonOutputZ } from "../agents/schemas.js";
import type { ToolDefinition } from "./registry.js";
import type { z } from "zod";

export type ClauseComparisonInput = z.infer<typeof ClauseComparisonInputZ>;
export type ClauseComparisonOutput = z.infer<typeof ClauseComparisonOutputZ>;

const SIMILAR_THRESHOLD = 0.45;
const DEVIATION_THRESHOLD = 0.3;

/**
 * Deterministic clause/policy comparison. No LLM.
 * Uses bilingual token overlap after Arabic folding.
 */
export function compareClauses(contractClause: string, policyClause: string): ClauseComparisonOutput {
  const overlap = tokenOverlap(contractClause, policyClause);
  return {
    tokenOverlap: overlap,
    similar: overlap >= SIMILAR_THRESHOLD,
    deviation: overlap < DEVIATION_THRESHOLD,
  };
}

export function createClauseComparisonTool(): ToolDefinition<
  ClauseComparisonInput,
  ClauseComparisonOutput
> {
  return {
    name: "clause_comparison_tool",
    inputSchema: ClauseComparisonInputZ,
    outputSchema: ClauseComparisonOutputZ,
    sideEffecting: false,
    async execute(input) {
      return compareClauses(input.contractClause, input.policyClause);
    },
  };
}
