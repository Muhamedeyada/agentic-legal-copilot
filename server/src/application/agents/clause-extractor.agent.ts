import type { CompletionPort } from "../../domain/ports/completion.port.js";
import { splitClauses } from "../../domain/chunking/split-clauses.js";
import type { ExtractedClause } from "../../domain/entities/workflow.js";
import type { TokenUsage } from "../../domain/entities/workflow.js";
import { ClauseExtractorOutputZ, parseContract } from "./schemas.js";
import type { ClauseExtractorOutput } from "./contracts.js";
import { classifyClause } from "./classify.js";
import { TRUSTED_SYSTEM_PREFIX, wrapUntrustedDocument } from "../security/prompt-isolation.js";
import { clipPrompt } from "../security/token-budget.js";
import type { ToolRegistry } from "../tools/registry.js";
import type { ToolContext } from "../tools/registry.js";

export interface ClauseExtractorInput {
  readonly contractId: string;
  readonly text: string;
}

function extractDeterministic(input: ClauseExtractorInput): ExtractedClause[] {
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

function parseJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced?.[1] ?? text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) {
    throw new Error("No JSON object in completion.");
  }
  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

export class ClauseExtractorAgent {
  constructor(
    private readonly completion: CompletionPort,
    private readonly tools: ToolRegistry,
  ) {}

  async run(
    input: ClauseExtractorInput,
    ctx: ToolContext,
  ): Promise<{ output: ClauseExtractorOutput; tokenUsage: TokenUsage; usedLlm: boolean }> {
    const fallback = extractDeterministic(input);
    try {
      const result = await this.completion.complete({
        jsonSchemaName: "clause_extractor_output",
        system: `${TRUSTED_SYSTEM_PREFIX} Extract contract clauses. Return JSON only matching {clauses: ExtractedClause[]}. Categories: liability, indemnity, ip, payment, termination, jurisdiction, confidentiality, other. Support Arabic and English headings.`,
        user: wrapUntrustedDocument(
          input.contractId,
          JSON.stringify({
            contractId: input.contractId,
            text: clipPrompt(input.text, 12_000),
            hint: fallback.map((c) => ({ id: c.id, heading: c.heading, category: c.category })),
          }),
        ),
      });
      const parsed = parseContract(ClauseExtractorOutputZ, "ClauseExtractorOutput", parseJsonObject(result.text));
      return {
        output: parsed,
        tokenUsage: result.usage ?? { promptTokens: 0, completionTokens: 0 },
        usedLlm: true,
      };
    } catch {
      void this.tools;
      void ctx;
      return {
        output: { clauses: fallback },
        tokenUsage: { promptTokens: 0, completionTokens: 0 },
        usedLlm: false,
      };
    }
  }
}
