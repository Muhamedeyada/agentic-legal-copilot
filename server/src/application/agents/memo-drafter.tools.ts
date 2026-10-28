import { z } from "zod";
import type { ToolName } from "../../domain/entities/workflow.js";
import type { ToolSpec } from "../../domain/ports/completion.port.js";
import { sanitizeModelText } from "../security/output-sanitize.js";
import { ClauseCategoryZ, ClauseComparisonInputZ, RetrievalToolInputZ } from "./schemas.js";
import type { RetrievalOutput } from "../tools/retrieval.tool.js";
import type { ClauseComparisonOutput } from "../tools/clause-comparison.tool.js";

/**
 * The only tools the drafter's model may call. save_draft_memo_tool stays deterministic and is never
 * exposed: the model can read the playbook, not write state.
 */
export const MODEL_TOOL_NAMES = ["retrieval_tool", "clause_comparison_tool"] as const satisfies readonly ToolName[];
export type ModelToolName = (typeof MODEL_TOOL_NAMES)[number];

export function isModelTool(name: string): name is ModelToolName {
  return (MODEL_TOOL_NAMES as readonly string[]).includes(name);
}

const MAX_MODEL_TOP_K = 5;
const MAX_COMPARE_CHARS = 2_000;
export const OBSERVATION_EXCERPT_CHARS = 280;

/** Model-supplied arguments are stricter than the tool contracts: no unknown keys, tighter bounds. */
export const MODEL_TOOL_ARGS = {
  retrieval_tool: RetrievalToolInputZ.extend({
    query: z.string().trim().min(1).max(300),
    topK: z.number().int().min(1).max(MAX_MODEL_TOP_K).optional(),
  }).strict(),
  clause_comparison_tool: ClauseComparisonInputZ.extend({
    contractClause: z.string().min(1).max(MAX_COMPARE_CHARS),
    policyClause: z.string().min(1).max(MAX_COMPARE_CHARS),
  }).strict(),
} satisfies Record<ModelToolName, z.ZodTypeAny>;

export const MEMO_DRAFTER_TOOL_SPECS: readonly ToolSpec[] = [
  {
    name: "retrieval_tool",
    description:
      "Search the review playbook and precedent corpus. Use it when a finding needs the standard clause or precedent wording before you propose a redline. Returns chunk IDs you may cite.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["query"],
      properties: {
        query: { type: "string", minLength: 1, maxLength: 300, description: "What to look for, e.g. 'liability cap standard'." },
        language: { type: "string", enum: ["ar", "en"] },
        category: { type: "string", enum: [...ClauseCategoryZ.options] },
        topK: { type: "integer", minimum: 1, maximum: MAX_MODEL_TOP_K },
      },
    },
  },
  {
    name: "clause_comparison_tool",
    description:
      "Measure how far a contract clause deviates from a playbook clause (token overlap). Use it to confirm a deviation before recommending a redline.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["contractClause", "policyClause"],
      properties: {
        contractClause: { type: "string", minLength: 1, maxLength: MAX_COMPARE_CHARS },
        policyClause: { type: "string", minLength: 1, maxLength: MAX_COMPARE_CHARS },
      },
    },
  },
];

/** What the model sees after a tool runs: bounded, sanitized, and still only real chunk IDs. */
export function observationFor(
  name: ModelToolName,
  output: RetrievalOutput | ClauseComparisonOutput,
): Record<string, unknown> {
  if (name === "retrieval_tool") {
    return {
      hits: (output as RetrievalOutput).hits.map((h) => ({
        chunkId: h.chunkId,
        documentId: h.documentId,
        language: h.language,
        excerpt: sanitizeModelText(h.text.slice(0, OBSERVATION_EXCERPT_CHARS)),
      })),
    };
  }
  return { ...(output as ClauseComparisonOutput) };
}
