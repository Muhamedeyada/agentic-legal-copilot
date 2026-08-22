import { Router } from "express";
import {
  ApprovalRequiredError,
  InvalidStateTransitionError,
  RunNotFoundError,
  SchemaViolationError,
} from "../../../domain/errors.js";
import type { LegalWorkflowOrchestrator } from "../../../application/orchestrator.js";
import type { CounselApprovalUseCase } from "../../../application/hitl/counsel-approval.js";
import { runSnapshot } from "../snapshot.js";
import type { WorkflowRun } from "../../../domain/entities/workflow.js";

function snapshot(run: WorkflowRun) {
  return runSnapshot(run);
}

export function reviewsRouter(
  orchestrator: LegalWorkflowOrchestrator,
  counselGate: CounselApprovalUseCase,
): Router {
  const router = Router();

  router.post("/runs", async (req, res) => {
    try {
      const language =
        req.body?.language === "ar" || req.body?.language === "both" ? req.body.language : "en";
      const contractId = String(req.body?.contractId ?? "contract-unknown");
      const text = String(req.body?.text ?? "");
      if (text.trim().length === 0) {
        res.status(400).json({ error: "INVALID_INPUT", message: "Contract text is required." });
        return;
      }
      const run = await orchestrator.start({ contractId, text, language });
      res.status(201).json(snapshot(run));
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown-error";
      res.status(500).json({ error: "WORKFLOW_FAILED", message });
    }
  });

  router.get("/runs/:runId", async (req, res) => {
    try {
      const run = await orchestrator.getRun(req.params.runId);
      res.json(snapshot(run));
    } catch (err) {
      if (err instanceof RunNotFoundError) {
        res.status(404).json({ error: err.code, message: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : "unknown-error";
      res.status(500).json({ error: "WORKFLOW_FAILED", message });
    }
  });

  router.post("/runs/:runId/approve", async (req, res) => {
    try {
      const counselId = String(req.body?.counselId ?? "counsel");
      const run = await counselGate.approveRun(req.params.runId, counselId);
      res.json(snapshot(run));
    } catch (err) {
      sendHitlError(res, err);
    }
  });

  router.post("/runs/:runId/reject", async (req, res) => {
    try {
      const counselId = String(req.body?.counselId ?? "counsel");
      const reason = String(req.body?.reason ?? "");
      const run = await counselGate.rejectRun(req.params.runId, reason, counselId);
      res.json(snapshot(run));
    } catch (err) {
      sendHitlError(res, err);
    }
  });

  router.post("/runs/:runId/edit-approve", async (req, res) => {
    try {
      const counselId = String(req.body?.counselId ?? "counsel");
      const editedMemo = {
        ...(typeof req.body?.bodyEn === "string" ? { bodyEn: req.body.bodyEn as string } : {}),
        ...(typeof req.body?.bodyAr === "string" ? { bodyAr: req.body.bodyAr as string } : {}),
      };
      const run = await counselGate.editAndApproveRun(req.params.runId, editedMemo, counselId);
      res.json(snapshot(run));
    } catch (err) {
      sendHitlError(res, err);
    }
  });

  router.post("/:reviewId/memo", async (req, res) => {
    try {
      const reviewId = req.params.reviewId;
      const language = req.body?.language === "ar" || req.body?.language === "both" ? req.body.language : "en";
      const result = await orchestrator.draftMemo({
        reviewId,
        contractId: String(req.body?.contractId ?? "unknown"),
        language,
      });
      res.json(result);
    } catch (err) {
      if (err instanceof ApprovalRequiredError) {
        res.status(403).json({ error: err.code, message: err.message });
        return;
      }
      if (err instanceof RunNotFoundError) {
        res.status(403).json({ error: "APPROVAL_REQUIRED", message: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : "unknown-error";
      res.status(501).json({ error: "NOT_IMPLEMENTED", message });
    }
  });

  return router;
}

function sendHitlError(res: import("express").Response, err: unknown): void {
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
