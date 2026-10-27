import { describe, expect, it } from "vitest";
import {
  classifyClause,
  detectRiskFlags,
  evidencedFamilies,
} from "../../src/application/agents/classify.js";
import {
  explainDeviation,
  governingLaw,
  isOneSidedTermination,
  shortestNoticeDays,
} from "../../src/application/agents/risk-explanations.js";
import { extractDeterministic } from "../../src/application/agents/clause-extractor.agent.js";
import { RiskAssessorAgent } from "../../src/application/agents/risk-assessor.agent.js";
import { ToolRegistry } from "../../src/application/tools/registry.js";
import { createRetrievalTool } from "../../src/application/tools/retrieval.tool.js";
import { createClauseComparisonTool } from "../../src/application/tools/clause-comparison.tool.js";
import { createRiskCalculatorTool } from "../../src/application/tools/risk-calculator.tool.js";
import { foldDigits, normalizeArabic } from "../../src/domain/retrieval/arabic-normalize.js";
import { InMemoryPlaybookAdapter } from "../../src/infrastructure/playbook/in-memory.adapter.js";

const playbook = new InMemoryPlaybookAdapter();

async function omissions(text: string, language: "ar" | "en"): Promise<string[]> {
  const tools = new ToolRegistry();
  tools.register(createRetrievalTool({ playbook }));
  tools.register(createClauseComparisonTool());
  tools.register(createRiskCalculatorTool());
  const clauses = extractDeterministic({ contractId: "t", text });
  const { output } = await new RiskAssessorAgent(tools, playbook).run(
    { contractId: "t", language, clauses },
    { runId: "r", agentId: "risk_assessor", state: "ASSESSING" },
  );
  return output.findings.filter((f) => f.omitted).map((f) => f.category);
}

const FULL_EN = [
  "## 1. Limitation of Liability",
  "Aggregate liability is capped at twelve months of fees.",
  "## 2. Indemnity",
  "Each party shall indemnify the other, capped at the liability cap.",
  "## 3. Termination",
  "Either party may terminate on thirty (30) days' prior written notice.",
  "## 4. Governing Law",
  "This Agreement is governed by the laws of England and Wales.",
];

describe("omission guard: loose headings do not count as a mandatory family", () => {
  it("a Liquidated Damages clause does not stand in for limitation of liability", async () => {
    expect(evidencedFamilies("## 7. Liquidated Damages", "The Supplier shall pay liquidated damages of 1% per week of delay.")).toEqual([]);
    const text = [
      "## 1. Liquidated Damages",
      "The Supplier shall pay liquidated damages of 1% per week of delay.",
      ...FULL_EN.slice(2),
    ].join("\n");
    expect(await omissions(text, "en")).toEqual(["liability"]);
  });

  it("a Notices clause that mentions termination notices does not make termination present", async () => {
    expect(evidencedFamilies("## 14. Notices", "Termination notices shall be sent by courier.")).toEqual([]);
    expect(evidencedFamilies("## 14. الإخطارات", "ترسل إخطارات الإنهاء بالبريد المسجل.")).toEqual([]);
    const text = [
      ...FULL_EN.slice(0, 4),
      "## 3. Notices",
      "Termination notices shall be sent by courier to the registered office.",
      ...FULL_EN.slice(6),
    ].join("\n");
    expect(await omissions(text, "en")).toEqual(["termination"]);
  });

  it("Arabic liquidated damages (التعويض الاتفاقي) is not an indemnity", () => {
    expect(evidencedFamilies("## 9. التعويض الاتفاقي", "يلتزم المورد بغرامة تأخير أسبوعية.")).toEqual([]);
    expect(evidencedFamilies("## 9. التعويض", "يعوض كل طرف الآخر عن مطالبات الغير.")).toEqual(["indemnity"]);
  });
});

describe("omission guard: compound headings keep their family", () => {
  it("Interpretation and Governing Law is a jurisdiction clause", async () => {
    expect(classifyClause("## 1. Interpretation and Governing Law", "This Agreement is governed by England and Wales.").category).toBe(
      "jurisdiction",
    );
    const text = [
      ...FULL_EN.slice(0, 6),
      "## 4. Interpretation and Governing Law",
      "Headings do not affect interpretation. This Agreement is governed by the laws of England and Wales.",
    ].join("\n");
    expect(await omissions(text, "en")).toEqual([]);
  });

  it("Background Intellectual Property is an IP clause, plain Background is not", () => {
    expect(classifyClause("## 6. Background Intellectual Property", "Each party retains its background IP.").category).toBe("ip");
    expect(classifyClause("## 1. Background", "The parties wish to share confidential information.").category).toBe("other");
  });

  it("one heading can establish two families", async () => {
    expect(evidencedFamilies("## 8. المسؤولية والتعويض", "تحد المسؤولية بأتعاب اثني عشر شهراً.")).toEqual(["liability", "indemnity"]);
    const text = [
      "## 1. Liability and Indemnification",
      "Aggregate liability is capped at twelve months of fees; each party indemnifies the other within that cap.",
      ...FULL_EN.slice(4),
    ].join("\n");
    expect(await omissions(text, "en")).toEqual([]);
  });
});

describe("governing law extraction", () => {
  it("handles 'governed by and construed in accordance with the laws of …'", () => {
    expect(
      governingLaw("This Agreement is governed by and construed in accordance with the laws of the United Arab Emirates."),
    ).toBe("United Arab Emirates");
    expect(governingLaw("This Agreement shall be governed by the laws of England and Wales without regard to conflict rules.")).toBe(
      "England and Wales",
    );
    expect(governingLaw("يخضع هذا العقد ويُفسَّر وفقاً لقوانين دولة الإمارات العربية المتحدة.")).toBe(
      "قوانين دولة الإمارات العربية المتحدة",
    );
  });

  it("ignores cross-references that are not laws", () => {
    expect(governingLaw("Any dispute governed by Clause 12 shall be referred to arbitration.")).toBeUndefined();
    expect(governingLaw("Fees are governed by this Agreement and the Order Form.")).toBeUndefined();
  });

  it("does not call the playbook's own law foreign when worded differently", async () => {
    const policyText = (await playbook.list()).find((c) => c.id === "playbook:en:jurisdiction")?.text ?? "";
    for (const clauseText of [
      "This Agreement is governed by English law.",
      "This Agreement is governed by and construed in accordance with the laws of England and Wales.",
    ]) {
      expect(explainDeviation({ category: "jurisdiction", clauseText, policyText })).toMatch(/^Governing law matches the playbook/);
    }
  });
});

describe("termination notice period", () => {
  it("ignores cure periods and delivery delays", () => {
    expect(shortestNoticeDays("Either party may terminate on 30 days notice if the other fails to cure within 10 days.")).toBe(30);
    expect(
      shortestNoticeDays("Either party may terminate on thirty (30) days' notice. Notices are deemed received 2 days after posting."),
    ).toBe(30);
    expect(shortestNoticeDays("ويجوز لأي طرف الإنهاء إذا بقي الإخلال قائماً بعد ثلاثين (30) يوماً من الإخطار الكتابي.")).toBeUndefined();
  });

  it("still finds real notice periods in either word order", () => {
    expect(shortestNoticeDays("Termination requires notice of fifteen (15) days.")).toBe(15);
    expect(shortestNoticeDays("The Provider may terminate on one (1) calendar day's notice.")).toBe(1);
    expect(shortestNoticeDays("يجوز لمقدم الخدمة إنهاء الاتفاق بإخطار كتابي مدته يوم تقويمي واحد (1).")).toBe(1);
  });

  it("does not misreport a 30-day notice with a 10-day cure as short", async () => {
    const policyText = (await playbook.list()).find((c) => c.id === "playbook:en:termination")?.text ?? "";
    const note = explainDeviation({
      category: "termination",
      clauseText: "Either party may terminate on 30 days notice if the other fails to cure within 10 days.",
      policyText,
    });
    expect(note).not.toMatch(/below the/);
  });
});

describe("two-sided termination rights", () => {
  it("treats joined, separate, or 'either party' grants as mutual", () => {
    expect(isOneSidedTermination("The Client or the Provider may terminate on 30 days notice.")).toBe(false);
    expect(
      isOneSidedTermination("The Customer may terminate on 30 days' notice. The Supplier may terminate on 30 days' notice."),
    ).toBe(false);
    expect(isOneSidedTermination("يحق للعميل أو لمقدم الخدمة فسخ العقد.")).toBe(false);
    expect(isOneSidedTermination("ويجوز لأي طرف الإنهاء للإخلال الجوهري.")).toBe(false);
  });

  it("does not treat the agreement ending by itself as a party's right", () => {
    expect(isOneSidedTermination("This Agreement may terminate automatically on insolvency.")).toBe(false);
  });

  it("still flags a right granted to one named party only", () => {
    expect(isOneSidedTermination("The Provider may terminate this Agreement on one (1) calendar day's notice.")).toBe(true);
    expect(isOneSidedTermination("يجوز لمقدم الخدمة إنهاء الاتفاق بإخطار كتابي.")).toBe(true);
  });
});

describe("Arabic-Indic numerals", () => {
  it("folds ٠-٩ and ۰-۹ to ASCII digits", () => {
    expect(foldDigits("مهلة ٣٠ يوماً و۱۵")).toBe("مهلة 30 يوماً و15");
    expect(normalizeArabic("(٣٠)")).toBe("(30)");
  });

  it("reads notice and survival periods written with Arabic-Indic digits", () => {
    expect(shortestNoticeDays("ويجوز لأي طرف إنهاؤه دون إبداء سبب بإخطار كتابي سابق مدته ١٥ يوماً.")).toBe(15);
    expect(
      explainDeviation({ category: "confidentiality", clauseText: "تسري التزامات السرية لمدة ثلاث (٣) سنوات.", policyText: "" }),
    ).toMatch(/^Confidentiality survives 3 years/);
    expect(
      explainDeviation({ category: "confidentiality", clauseText: "تسري التزامات السرية لمدة سنتين بعد انتهاء العقد.", policyText: "" }),
    ).toMatch(/^Confidentiality survives 2 years/);
  });

  it("takes the survival term, not another duration in the clause", () => {
    expect(
      explainDeviation({
        category: "confidentiality",
        clauseText: "The licence lasts five (5) years. These obligations survive indefinitely.",
        policyText: "",
      }),
    ).toBe("Indefinite survival term exceeding standard duration guidelines.");
  });
});

describe("uncapped liability flag", () => {
  it("does not treat a capped clause with a fraud carve-out as uncapped", () => {
    expect(detectRiskFlags("Liability is capped at fees paid, but is unlimited for fraud.").unlimitedLiability).toBe(false);
    expect(
      detectRiskFlags("Aggregate liability is limited to fees. Liability for wilful misconduct is uncapped.").unlimitedLiability,
    ).toBe(false);
    expect(detectRiskFlags("تحد المسؤولية بالأتعاب، وتكون غير محدودة في حالات الاحتيال.").unlimitedLiability).toBe(false);
    expect(
      explainDeviation({
        category: "liability",
        clauseText: "Liability is capped at fees paid, but is unlimited for fraud. Neither party is liable for indirect loss.",
        policyText: "x",
      }),
    ).not.toMatch(/uncapped/i);
  });

  it("still flags a genuinely uncapped clause, in English and Arabic", () => {
    expect(detectRiskFlags("Liability is unlimited, including for fraud.").unlimitedLiability).toBe(true);
    expect(detectRiskFlags("The Supplier's liability shall not be subject to any monetary cap.").unlimitedLiability).toBe(true);
    expect(detectRiskFlags("المسؤولية غير محدودة.").unlimitedLiability).toBe(true);
  });

  it("matches Arabic flags against folded text", () => {
    expect(detectRiskFlags("غرامة تأخير خمسة عشر % يومياً").punitiveLateFee).toBe(true);
  });
});
