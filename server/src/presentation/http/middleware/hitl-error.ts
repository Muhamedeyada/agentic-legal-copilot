import type { Response } from "express";
import {
  ApprovalRequiredError,
  InvalidStateTransitionError,
  RunNotFoundError,
  SchemaViolationError,
} from "../../../domain/errors.js";
import type { CounselEditedMemo } from "../../../domain/ports/approval.port.js";

export function sendHitlError(res: Response, err: unknown): void {
  if (err instanceof RunNotFoundError) {
    res.status(404).json({ error: err.code, message: err.message });
    return;
  }
  if (err instanceof InvalidStateTransitionError || err instanceof ApprovalRequiredError) {
    res.status(409).json({ error: err.code, message: err.message });
    return;
  }
  if (err instanceof SchemaViolationError) {
    res.status(400).json({ error: err.code, message: err.message });
    return;
  }
  const message = err instanceof Error ? err.message : "unknown-error";
  res.status(400).json({ error: "HITL_FAILED", message });
}

export function parseEditedMemo(body: unknown): CounselEditedMemo {
  if (typeof body !== "object" || body === null) {
    return {};
  }
  const rec = body as Record<string, unknown>;
  const memo: { bodyEn?: string; bodyAr?: string } = {};
  if (typeof rec.bodyEn === "string") {
    memo.bodyEn = rec.bodyEn;
  } else if (typeof rec.editedMemo === "string") {
    memo.bodyEn = rec.editedMemo;
  }
  if (typeof rec.bodyAr === "string") {
    memo.bodyAr = rec.bodyAr;
  }
  return memo;
}
