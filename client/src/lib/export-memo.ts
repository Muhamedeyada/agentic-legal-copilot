import type { ReviewMemo, WorkflowSnapshot } from "../api/types";

export function buildMemoMarkdown(input: {
  snapshot: WorkflowSnapshot;
  memo: ReviewMemo;
  contractTitle: string;
  counselId: string;
  exportedAt: string;
}): string {
  const { snapshot, memo, contractTitle, counselId, exportedAt } = input;
  const cites = memo.citations
    .map(
      (c) =>
        `- \`${c.id}\` · ${c.source} · ${c.locator} · ${c.language}${c.isTranslation ? " · translation" : ""}\n  ${c.excerpt}`,
    )
    .join("\n");
  return [
    "# Counsel-approved review memo",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Product | D1T1 Agentic Legal Copilot |`,
    `| Contract | ${contractTitle} (\`${snapshot.contractId}\`) |`,
    `| Run | \`${snapshot.runId}\` |`,
    `| State | ${snapshot.state} |`,
    `| Language | ${memo.language} |`,
    `| Counsel | ${counselId} |`,
    `| Approved | ${memo.approvedByCounsel ? "yes" : "no"} |`,
    `| Run created | ${snapshot.createdAt} |`,
    `| Run updated | ${snapshot.updatedAt} |`,
    `| Exported | ${exportedAt} |`,
    "",
    "> Assistive draft. Not legal advice. Issued only after Counsel approval.",
    "",
    "## English",
    "",
    memo.bodyEn?.trim() || "_(no English body)_",
    "",
    "## العربية",
    "",
    memo.bodyAr?.trim() || "_(لا يوجد نص عربي)_",
    "",
    "## Citations",
    "",
    cites || "_(none)_",
    "",
  ].join("\n");
}

export function downloadTextFile(filename: string, contents: string): void {
  const blob = new Blob([contents], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
