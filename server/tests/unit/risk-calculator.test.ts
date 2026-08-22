import { describe, expect, it } from "vitest";
import { calculateRisk } from "../../src/application/tools/risk-calculator.tool.js";

const cleanFlags = {
  unlimitedLiability: false,
  uncappedIndemnity: false,
  oneDayTermination: false,
  unilateralIp: false,
  punitiveLateFee: false,
};

describe("risk_calculator_tool (deterministic matrix)", () => {
  it("scores silent omission of mandatory families as critical", () => {
    for (const category of ["liability", "termination", "jurisdiction", "indemnity"] as const) {
      const result = calculateRisk({
        category,
        omitted: true,
        similarityToPlaybook: 0,
        flags: cleanFlags,
      });
      expect(result.severity).toBe("critical");
      expect(result.reasons.some((r) => /silent omission/i.test(r))).toBe(true);
    }
  });

  it("scores unlimited liability as critical even when the clause is present", () => {
    const result = calculateRisk({
      category: "liability",
      omitted: false,
      similarityToPlaybook: 0.9,
      flags: { ...cleanFlags, unlimitedLiability: true },
    });
    expect(result.severity).toBe("critical");
  });

  it("does not invent a score — aligned clauses stay low", () => {
    const a = calculateRisk({
      category: "payment",
      omitted: false,
      similarityToPlaybook: 0.8,
      flags: cleanFlags,
    });
    const b = calculateRisk({
      category: "payment",
      omitted: false,
      similarityToPlaybook: 0.8,
      flags: cleanFlags,
    });
    expect(a).toEqual(b);
    expect(a.severity).toBe("low");
  });
});
