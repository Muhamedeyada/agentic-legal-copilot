import { MANDATORY_CLAUSE_CATEGORIES } from "../../domain/entities/clause-category.js";
import type { ClauseCategory } from "../../domain/entities/clause-category.js";
import type { ExtractedClause, TokenUsage } from "../../domain/entities/workflow.js";
import type { RiskFinding } from "../../domain/entities/risk.js";
import type { PlaybookPort } from "../../domain/ports/playbook.port.js";
import { RiskAssessorOutputZ, parseContract } from "./schemas.js";
import type { RiskAssessorOutput } from "./contracts.js";
import { detectRiskFlags } from "./classify.js";
import type { ToolRegistry, ToolContext } from "../tools/registry.js";
import type { RetrievalOutput } from "../tools/retrieval.tool.js";
import type { ClauseComparisonOutput } from "../tools/clause-comparison.tool.js";
import type { RiskCalculatorOutput } from "../tools/risk-calculator.tool.js";

export interface RiskAssessorInput {
  readonly contractId: string;
  readonly language: "ar" | "en" | "both";
  readonly clauses: readonly ExtractedClause[];
}

export class RiskAssessorAgent {
  constructor(
    private readonly tools: ToolRegistry,
    private readonly playbook: PlaybookPort,
  ) {}

  async run(
    input: RiskAssessorInput,
    ctx: ToolContext,
  ): Promise<{ output: RiskAssessorOutput; tokenUsage: TokenUsage }> {
    const findings: RiskFinding[] = [];
    const present = new Set(input.clauses.map((c) => c.category));
    const lang = input.language === "both" ? undefined : input.language;

    for (const category of MANDATORY_CLAUSE_CATEGORIES) {
      if (present.has(category)) {
        continue;
      }
      const retrieval = await this.tools.invoke<unknown, RetrievalOutput>(
        "retrieval_tool",
        {
          query: category,
          category,
          topK: 3,
          ...(lang ? { language: lang } : {}),
        },
        ctx,
      );
      const scored = await this.tools.invoke<unknown, RiskCalculatorOutput>(
        "risk_calculator_tool",
        {
          category,
          omitted: true,
          similarityToPlaybook: 0,
          flags: {
            unlimitedLiability: false,
            uncappedIndemnity: false,
            oneDayTermination: false,
            unilateralIp: false,
            punitiveLateFee: false,
          },
        },
        ctx,
      );
      findings.push({
        id: `${input.contractId}:omission:${category}`,
        clauseId: `omitted:${category}`,
        category,
        severity: scored.severity,
        rationale: scored.reasons.join(" "),
        citationIds: retrieval.hits.map((h) => h.chunkId),
        omitted: true,
      });
    }

    for (const clause of input.clauses) {
      const clauseLang =
        clause.language === "ar" || clause.language === "en" ? clause.language : lang;
      const retrieval = await this.tools.invoke<unknown, RetrievalOutput>(
        "retrieval_tool",
        {
          query: clause.text.slice(0, 500),
          category: clause.category,
          topK: 3,
          ...(clauseLang ? { language: clauseLang } : {}),
        },
        ctx,
      );
      const policy = retrieval.hits[0]?.text ?? (await this.policyText(clause.category, lang));
      const comparison =
        policy.trim().length > 0
          ? await this.tools.invoke<unknown, ClauseComparisonOutput>(
              "clause_comparison_tool",
              { contractClause: clause.text, policyClause: policy },
              ctx,
            )
          : { tokenOverlap: 0, similar: false, deviation: true };
      const flags = detectRiskFlags(`${clause.heading}\n${clause.text}`);
      const scored = await this.tools.invoke<unknown, RiskCalculatorOutput>(
        "risk_calculator_tool",
        {
          category: clause.category,
          omitted: false,
          similarityToPlaybook: comparison.tokenOverlap,
          flags,
        },
        ctx,
      );
      findings.push({
        id: `${clause.id}:risk`,
        clauseId: clause.id,
        category: clause.category,
        severity: scored.severity,
        rationale: scored.reasons.join(" "),
        citationIds: retrieval.hits.map((h) => h.chunkId),
        omitted: false,
      });
    }

    const output = parseContract(RiskAssessorOutputZ, "RiskAssessorOutput", { findings });
    return { output, tokenUsage: { promptTokens: 0, completionTokens: 0 } };
  }

  private async policyText(category: ClauseCategory, language: "ar" | "en" | undefined): Promise<string> {
    const rows = await this.playbook.byCategory(category, language);
    return rows[0]?.text ?? "";
  }
}
