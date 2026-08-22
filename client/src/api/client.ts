import type {
  ContractRecord,
  ContractSummary,
  RagAnswer,
  WorkflowSnapshot,
} from "./types";

const base = import.meta.env.VITE_API_URL ?? "";

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  return data;
}

export async function fetchHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${base}/api/health`);
    return res.ok;
  } catch {
    return false;
  }
}

export async function listContracts(): Promise<ContractSummary[]> {
  const res = await fetch(`${base}/api/contracts`);
  if (!res.ok) {
    throw new Error("Failed to list contracts");
  }
  const data = await parseJson<{ items: ContractSummary[] }>(res);
  return data.items;
}

export async function getContract(id: string): Promise<ContractRecord> {
  const res = await fetch(`${base}/api/contracts/${encodeURIComponent(id)}`);
  if (!res.ok) {
    throw new Error("Failed to load contract");
  }
  return parseJson<ContractRecord>(res);
}

export async function uploadContract(input: {
  title: string;
  language: "ar" | "en";
  text: string;
}): Promise<ContractRecord> {
  const res = await fetch(`${base}/api/contracts/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error("Upload failed");
  }
  return parseJson<ContractRecord>(res);
}

export async function startWorkflow(input: {
  contractId: string;
  language: "ar" | "en" | "both";
  text?: string;
}): Promise<{ runId: string }> {
  const res = await fetch(`${base}/api/workflow/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error("Failed to start workflow");
  }
  return parseJson<{ runId: string }>(res);
}

export async function getRun(runId: string): Promise<WorkflowSnapshot> {
  const res = await fetch(`${base}/api/workflow/${encodeURIComponent(runId)}`);
  if (!res.ok) {
    throw new Error("Failed to load run");
  }
  return parseJson<WorkflowSnapshot>(res);
}

export function workflowStreamUrl(runId: string): string {
  return `${base}/api/workflow/stream/${encodeURIComponent(runId)}`;
}

export async function cancelRun(runId: string): Promise<void> {
  await fetch(`${base}/api/workflow/${encodeURIComponent(runId)}/cancel`, { method: "POST" });
}

export async function approveRun(runId: string, counselId: string): Promise<WorkflowSnapshot> {
  const res = await fetch(`${base}/api/workflow/${encodeURIComponent(runId)}/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ counselId }),
  });
  if (!res.ok) {
    throw new Error("Approve failed");
  }
  return parseJson<WorkflowSnapshot>(res);
}

export async function rejectRun(
  runId: string,
  reason: string,
  counselId: string,
): Promise<WorkflowSnapshot> {
  const res = await fetch(`${base}/api/workflow/${encodeURIComponent(runId)}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ counselId, reason, comments: reason }),
  });
  if (!res.ok) {
    throw new Error("Reject failed");
  }
  return parseJson<WorkflowSnapshot>(res);
}

export async function editAndApproveRun(
  runId: string,
  counselId: string,
  edited: { bodyEn?: string; bodyAr?: string },
): Promise<WorkflowSnapshot> {
  const res = await fetch(`${base}/api/workflow/${encodeURIComponent(runId)}/edit-and-approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ counselId, ...edited }),
  });
  if (!res.ok) {
    throw new Error("Edit-and-approve failed");
  }
  return parseJson<WorkflowSnapshot>(res);
}

export async function askRag(input: {
  query: string;
  language?: "ar" | "en";
  documentId?: string;
}): Promise<RagAnswer> {
  const res = await fetch(`${base}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseJson<RagAnswer & { error?: string }>(res);
  if (res.status === 404) {
    return {
      answer: "",
      refused: true,
      reason: data.reason ?? "not_enough_information",
      citations: data.citations ?? [],
    };
  }
  if (!res.ok) {
    throw new Error(data.error ?? "RAG request failed");
  }
  return data;
}
