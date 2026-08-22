import { isMandatoryCategory } from "../../domain/entities/clause-category.js";
import type { RiskSeverity } from "../../domain/entities/risk.js";
import { RiskCalculatorInputZ, RiskCalculatorOutputZ } from "../agents/schemas.js";
import type { ToolDefinition } from "./registry.js";
import type { z } from "zod";

export type RiskCalculatorInput = z.infer<typeof RiskCalculatorInputZ>;
export type RiskCalculatorOutput = z.infer<typeof RiskCalculatorOutputZ>;

const RANK: Record<RiskSeverity, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

function worse(a: RiskSeverity, b: RiskSeverity): RiskSeverity {
  return RANK[a] >= RANK[b] ? a : b;
}

/**
 * Deterministic risk scoring matrix. Severity is never produced by an LLM.
 *
 * Silent omission of a mandatory family (liability, termination, jurisdiction, indemnity)
 * is always Critical — the D1 guardrail.
 */
export function calculateRisk(input: RiskCalculatorInput): RiskCalculatorOutput {
  const reasons: string[] = [];
  let severity: RiskSeverity = "low";

  if (input.omitted && isMandatoryCategory(input.category)) {
    severity = "critical";
    reasons.push(`Silent omission of mandatory ${input.category} clause.`);
  }

  if (input.flags.unlimitedLiability) {
    severity = worse(severity, "critical");
    reasons.push("Unlimited / uncapped liability.");
  }
  if (input.flags.uncappedIndemnity) {
    severity = worse(severity, "critical");
    reasons.push("Uncapped indemnity.");
  }
  if (input.flags.oneDayTermination) {
    severity = worse(severity, "high");
    reasons.push("Termination notice of one calendar day or less.");
  }
  if (input.flags.unilateralIp) {
    severity = worse(severity, "high");
    reasons.push("Unilateral assignment of intellectual property.");
  }
  if (input.flags.punitiveLateFee) {
    severity = worse(severity, "high");
    reasons.push("Punitive late-payment fees.");
  }

  if (!input.omitted) {
    if (input.similarityToPlaybook < 0.2) {
      severity = worse(severity, "high");
      reasons.push("Material deviation from playbook standard (similarity < 0.20).");
    } else if (input.similarityToPlaybook < 0.45) {
      severity = worse(severity, "medium");
      reasons.push("Partial deviation from playbook standard.");
    }
  }

  if (reasons.length === 0) {
    reasons.push("Aligned with playbook standard.");
  }

  return { severity, reasons };
}

export function createRiskCalculatorTool(): ToolDefinition<RiskCalculatorInput, RiskCalculatorOutput> {
  return {
    name: "risk_calculator_tool",
    inputSchema: RiskCalculatorInputZ,
    outputSchema: RiskCalculatorOutputZ,
    sideEffecting: false,
    async execute(input) {
      return calculateRisk(input);
    },
  };
}
