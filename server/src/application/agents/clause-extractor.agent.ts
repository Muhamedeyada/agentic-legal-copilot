import type { CompletionPort } from "../../domain/ports/completion.port.js";
import { splitClauses } from "../../domain/chunking/split-clauses.js";
import type { ExtractedClause } from "../../domain/entities/workflow.js";
import type { TokenUsage } from "../../domain/entities/workflow.js";
import { ClauseExtractorOutputZ, parseContract } from "./schemas.js";
import type { ClauseExtractorOutput } from "./contracts.js";
import { classifyClause } from "./classify.js";
import { TRUSTED_SYSTEM_PREFIX, wrapUntrustedDocument } from "../security/prompt-isolation.js";
import { parseJsonObject } from "./json.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { ToolContext } from "../tools/registry.js";

export interface ClauseExtractorInput {
  readonly contractId: string;
  readonly text: string;
}

export function extractDeterministic(input: ClauseExtractorInput): ExtractedClause[] {
  return splitClauses(input.text).map((part, index) => {
    const { category, standard } = classifyClause(part.heading, part.text);
    return {
      id: `${input.contractId}:clause:${index + 1}`,
      contractId: input.contractId,
      category,
      title: part.title,
      text: part.text,
      language: part.language,
      heading: part.heading,
      standard,
      spanStart: part.spanStart,
      spanEnd: part.spanEnd,
    };
  });
}

export class ClauseExtractorAgent {
  constructor(
    private readonly completion: CompletionPort,
    _tools?: ToolRegistry,
  ) {}

  async run(
    input: ClauseExtractorInput,
    _ctx?: ToolContext,
  ): Promise<{ output: ClauseExtractorOutput; tokenUsage: TokenUsage; usedLlm: boolean; provider: string }> {
    const fallback = extractDeterministic(input);
    let tokenUsage: TokenUsage = { promptTokens: 0, completionTokens: 0 };
    let provider = "deterministic";
    try {
      const result = await this.completion.complete({
        jsonSchemaName: "clause_extractor_output",
        system: `${TRUSTED_SYSTEM_PREFIX} Extract contract clauses. Return JSON only matching {clauses: ExtractedClause[]}. Categories: liability, indemnity, ip, payment, termination, jurisdiction, confidentiality, other. Support Arabic and English headings.`,
        user: wrapUntrustedDocument(
          input.contractId,
          JSON.stringify({
            contractId: input.contractId,
            text: input.text,
            hint: fallback.map((c) => ({ id: c.id, heading: c.heading, category: c.category })),
          }),
        ),
      });
      tokenUsage = result.usage ?? tokenUsage;
      provider = result.providerId;
      const parsed = parseContract(ClauseExtractorOutputZ, "ClauseExtractorOutput", parseJsonObject(result.text));
      return { output: parsed, tokenUsage, usedLlm: true, provider };
    } catch {
      return { output: { clauses: fallback }, tokenUsage, usedLlm: false, provider };
    }
  }
}
