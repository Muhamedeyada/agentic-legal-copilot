import { describe, expect, it } from "vitest";
import {
  excludesConsequentialLoss,
  explainDeviation,
  governingLaw,
  isOneSidedTermination,
  shortestNoticeDays,
} from "../../src/application/agents/risk-explanations.js";
import { classifyClause } from "../../src/application/agents/classify.js";
import { calculateRisk } from "../../src/application/tools/risk-calculator.tool.js";
import { RiskAssessorAgent } from "../../src/application/agents/risk-assessor.agent.js";
import { extractDeterministic } from "../../src/application/agents/clause-extractor.agent.js";
import { ToolRegistry } from "../../src/application/tools/registry.js";
import { createRetrievalTool } from "../../src/application/tools/retrieval.tool.js";
import { createClauseComparisonTool } from "../../src/application/tools/clause-comparison.tool.js";
import { createRiskCalculatorTool } from "../../src/application/tools/risk-calculator.tool.js";
import { InMemoryPlaybookAdapter } from "../../src/infrastructure/playbook/in-memory.adapter.js";

const playbook = new InMemoryPlaybookAdapter();

async function policy(id: string): Promise<string> {
  return (await playbook.list()).find((c) => c.id === id)?.text ?? "";
}

describe("explainDeviation — liability", () => {
  it("uses the uncapped wording only when no cap and no consequential exclusion are found", () => {
    expect(
      explainDeviation({
        category: "liability",
        clauseText: "The Supplier's liability shall not be subject to any monetary cap.",
        policyText: "x",
      }),
    ).toBe("Uncapped liability structure lacking aggregate maximum and consequential damage exclusion.");
  });

  it("does not call a capped clause uncapped", () => {
    const note = explainDeviation({
      category: "liability",
      clauseText:
        "Aggregate liability is limited to twenty-four months of fees. Neither party is liable for indirect or consequential damages.",
      policyText: "x",
    });
    expect(note).not.toMatch(/uncapped/i);
  });

  it("treats a disapplied exclusion, or consequential loss listed as covered, as no exclusion", () => {
    expect(
      excludesConsequentialLoss("The exclusion of indirect loss in the playbook is expressly disapplied between the parties."),
    ).toBe(false);
    expect(
      excludesConsequentialLoss(
        "Liability including consequential and indirect loss shall not be subject to any monetary cap.",
      ),
    ).toBe(false);
    expect(excludesConsequentialLoss("لا يُسأل أي طرف عن الأضرار غير المباشرة أو التبعية.")).toBe(true);
  });
});

describe("explainDeviation — indemnity", () => {
  it("flags a broad indemnity with no gross negligence carve-out", () => {
    expect(
      explainDeviation({
        category: "indemnity",
        clauseText: "The Customer shall indemnify the Supplier against all claims, without any cap.",
        policyText: "x",
      }),
    ).toBe("Broad indemnification obligation missing standard gross negligence exemptions.");
  });

  it("does not claim a missing carve-out when gross negligence is addressed", () => {
    const note = explainDeviation({
      category: "indemnity",
      clauseText: "Each party indemnifies the other, capped at the liability cap, except for gross negligence.",
      policyText: "x",
    });
    expect(note).not.toMatch(/gross negligence exemptions/);
  });
});

describe("explainDeviation — termination", () => {
  it("names an asymmetric short notice only when both facts are present", async () => {
    const policyText = await policy("playbook:ar:termination");
    expect(
      explainDeviation({
        category: "termination",
        clauseText: "يجوز لمقدم الخدمة إنهاء الاتفاق بإخطار كتابي مدته يوم تقويمي واحد (1).",
        policyText,
      }),
    ).toBe("Asymmetric termination notice timeline violating minimum grace period standards.");
  });

  it("reports a short but mutual notice with the actual numbers", async () => {
    expect(
      explainDeviation({
        category: "termination",
        clauseText: "Either party may terminate for convenience on fifteen (15) days' written notice.",
        policyText: await policy("playbook:en:termination"),
      }),
    ).toBe("Termination notice of 15 days is below the 30-day minimum grace period.");
  });

  it("does not flag a mutual 30-day notice as short or one-sided", async () => {
    // "30 days after written notice" is a cure period, not a notice period.
    const text = "Either party may terminate for material breach uncured thirty (30) days after written notice.";
    expect(shortestNoticeDays(text)).toBeUndefined();
    expect(isOneSidedTermination(text)).toBe(false);
    expect(isOneSidedTermination("ويجوز لأي طرف الإنهاء للإخلال الجوهري بعد ثلاثين (30) يوماً من الإخطار.")).toBe(false);
    expect(
      explainDeviation({ category: "termination", clauseText: text, policyText: await policy("playbook:en:termination") }),
    ).toBe("Termination terms deviate from the cited playbook clause.");
  });
});

describe("explainDeviation — jurisdiction", () => {
  it("names both laws when they differ", async () => {
    expect(
      explainDeviation({
        category: "jurisdiction",
        clauseText: "This agreement is governed by State of Delaware, excluding conflict-of-law rules.",
        policyText: await policy("playbook:en:jurisdiction"),
      }),
    ).toBe("Designated foreign governing law (State of Delaware) deviates from default domestic venue (England and Wales).");
  });

  it("recognises the playbook law in English and Arabic", async () => {
    expect(
      explainDeviation({
        category: "jurisdiction",
        clauseText: "This agreement is governed by England and Wales.",
        policyText: await policy("playbook:en:jurisdiction"),
      }),
    ).toBe(
      "Governing law matches the playbook (England and Wales); the remaining wording differs from the cited playbook clause.",
    );
    expect(governingLaw("يخضع هذا العقد لـ قوانين جمهورية مصر العربية دون قواعد تنازع القوانين.")).toBe(
      "قوانين جمهورية مصر العربية",
    );
    expect(
      explainDeviation({
        category: "jurisdiction",
        clauseText: "يخضع هذا العقد لـ قوانين جمهورية مصر العربية دون قواعد تنازع القوانين.",
        policyText: await policy("playbook:ar:jurisdiction"),
      }),
    ).toMatch(/^Designated foreign governing law \(قوانين جمهورية مصر العربية\)/);
  });
});

describe("explainDeviation — confidentiality", () => {
  it("does not call a 3-year term indefinite because trade secrets survive indefinitely", () => {
    const note = explainDeviation({
      category: "confidentiality",
      clauseText:
        "The duties in this clause survive for three (3) years after termination, and indefinitely for trade secrets.",
      policyText: "",
    });
    expect(note).toBe(
      "Confidentiality survives 3 years (trade secrets indefinitely); the playbook has no confidentiality standard yet, so review it manually.",
    );
  });

  it("flags an indefinite term with no fixed duration", () => {
    expect(
      explainDeviation({
        category: "confidentiality",
        clauseText: "These obligations survive indefinitely.",
        policyText: "",
      }),
    ).toBe("Indefinite survival term exceeding standard duration guidelines.");
  });
});

describe("risk_calculator_tool deviation reasons", () => {
  it("uses the category note and the measured similarity", () => {
    const result = calculateRisk({
      category: "termination",
      omitted: false,
      similarityToPlaybook: 0.1,
      flags: {
        unlimitedLiability: false,
        uncappedIndemnity: false,
        oneDayTermination: false,
        unilateralIp: false,
        punitiveLateFee: false,
      },
      deviationNote: "Termination notice of 15 days is below the 30-day minimum grace period.",
    });
    expect(result.severity).toBe("high");
    expect(result.reasons).toEqual([
      "Termination notice of 15 days is below the 30-day minimum grace period. (playbook similarity 0.10 < 0.20)",
    ]);
  });
});

describe("clause classification", () => {
  it("lets the heading decide over body mentions", () => {
    expect(
      classifyClause("## 5. Confidentiality", "Keep information secret; on termination return all materials.").category,
    ).toBe("confidentiality");
    expect(
      classifyClause("## 9. القانون الحاكم وفض المنازعات", "يخضع هذا العقد لقوانين مصر. ويجوز الإنهاء بإخطار.").category,
    ).toBe("jurisdiction");
    expect(classifyClause("## 2. Definitions", "\"Business Day\" ... the jurisdiction of England.").category).toBe("other");
  });

  it("does not report liability omitted when it shares a heading with indemnity", async () => {
    const tools = new ToolRegistry();
    tools.register(createRetrievalTool({ playbook }));
    tools.register(createClauseComparisonTool());
    tools.register(createRiskCalculatorTool());
    const clauses = extractDeterministic({
      contractId: "combo",
      text: [
        "## 1. المسؤولية والتعويض",
        "تُحد مسؤولية كل طرف بأتعاب اثني عشر شهراً، ويعوض كل طرف الآخر في حدود هذا السقف.",
        "## 2. مدة العقد والإنهاء",
        "ويجوز لأي طرف الإنهاء بإخطار كتابي مدته ثلاثون (30) يوماً.",
        "## 3. القانون الحاكم",
        "يخضع هذا العقد لقوانين إنجلترا وويلز.",
      ].join("\n"),
    });
    // Filed under the family the heading names first.
    expect(clauses[0]?.category).toBe("liability");
    const { output } = await new RiskAssessorAgent(tools, playbook).run(
      { contractId: "combo", language: "ar", clauses },
      { runId: "r", agentId: "risk_assessor", state: "ASSESSING" },
    );
    expect(output.findings.filter((f) => f.omitted).map((f) => f.category)).toEqual([]);
  });
});
