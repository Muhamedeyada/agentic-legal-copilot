import type {
  ContractRecord,
  ContractSummary,
  RagAnswer,
  WorkflowSnapshot,
} from "./types";

function resolveBaseUrl(): string {
  const envUrl = (import.meta.env.VITE_API_URL ?? "").trim().replace(/\/+$/, "");

  // In production, never assume or connect to localhost / 127.0.0.1; default to relative path ""
  if (import.meta.env.PROD) {
    if (!envUrl || envUrl.includes("localhost") || envUrl.includes("127.0.0.1")) {
      return "";
    }
    return envUrl;
  }

  return envUrl;
}

const base = resolveBaseUrl();

const analystToken = import.meta.env.VITE_API_TOKEN || "demo-analyst-token";
const counselToken = import.meta.env.VITE_COUNSEL_TOKEN || "demo-counsel-token";

function authHeaders(token: string = analystToken): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

function jsonHeaders(token?: string): Record<string, string> {
  return { "Content-Type": "application/json", ...authHeaders(token) };
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T;
  return data;
}

export async function fetchHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${base}/api/health`);
    if (res.ok) {
      return true;
    }
    const fallbackRes = await fetch(`${base}/health`);
    return fallbackRes.ok;
  } catch {
    return false;
  }
}

export async function listContracts(): Promise<ContractSummary[]> {
  const res = await fetch(`${base}/api/contracts`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error("Failed to list contracts");
  }
  const data = await parseJson<{ items: ContractSummary[] }>(res);
  return data.items;
}

export async function getContract(id: string): Promise<ContractRecord> {
  const res = await fetch(`${base}/api/contracts/${encodeURIComponent(id)}`, { headers: authHeaders() });
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
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error("Upload failed");
  }
  return parseJson<ContractRecord>(res);
}

export interface UploadedContract extends ContractRecord {
  readonly redactions?: ReadonlyArray<{ kind: string; count: number }>;
}

export class UploadError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Multipart upload of a PDF, DOCX, TXT or MD file; the server extracts text and redacts personal data. */
export async function uploadContractFile(file: File): Promise<UploadedContract> {
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(`${base}/api/contracts/upload-file`, { method: "POST", headers: authHeaders(), body: form });
  const data = (await res.json().catch(() => ({}))) as Partial<UploadedContract> & { error?: string; message?: string };
  if (!res.ok) {
    throw new UploadError(res.status, data.error ?? "", data.message ?? "Upload failed");
  }
  return data as UploadedContract;
}

export async function startWorkflow(input: {
  contractId: string;
  language: "ar" | "en" | "both";
  text?: string;
}): Promise<{ runId: string }> {
  const res = await fetch(`${base}/api/workflow/run`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    throw new Error("Failed to start workflow");
  }
  return parseJson<{ runId: string }>(res);
}

export async function getRun(runId: string): Promise<WorkflowSnapshot> {
  const res = await fetch(`${base}/api/workflow/${encodeURIComponent(runId)}`, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error("Failed to load run");
  }
  return parseJson<WorkflowSnapshot>(res);
}

export function workflowStreamUrl(runId: string): string {
  return `${base}/api/workflow/stream/${encodeURIComponent(runId)}?access_token=${encodeURIComponent(analystToken)}`;
}

export async function cancelRun(runId: string): Promise<void> {
  await fetch(`${base}/api/workflow/${encodeURIComponent(runId)}/cancel`, {
    method: "POST",
    headers: authHeaders(),
  });
}

export async function approveRun(runId: string, counselId: string): Promise<WorkflowSnapshot> {
  const res = await fetch(`${base}/api/workflow/${encodeURIComponent(runId)}/approve`, {
    method: "POST",
    headers: jsonHeaders(counselToken),
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
    headers: jsonHeaders(counselToken),
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
    headers: jsonHeaders(counselToken),
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
    headers: jsonHeaders(),
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
