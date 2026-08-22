import type { Response } from "express";
import { Router } from "express";
import {
  ApprovalRequiredError,
  InvalidStateTransitionError,
  RunNotFoundError,
  SchemaViolationError,
} from "../../../domain/errors.js";
import type { LegalWorkflowOrchestrator } from "../../../application/orchestrator.js";
import type { CounselApprovalUseCase } from "../../../application/hitl/counsel-approval.js";
import type { RunEventBus } from "../../../application/orchestration/event-bus.js";
import type { ContractCatalogPort } from "../../../domain/ports/contract-catalog.port.js";
import type { WorkflowStreamEvent } from "../../../application/orchestration/events.js";
import { runSnapshot } from "../snapshot.js";

function writeSse(res: Response, event: WorkflowStreamEvent | { type: "ping"; at: number }): void {
  res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
}

export function workflowRouter(deps: {
  orchestrator: LegalWorkflowOrchestrator;
  counselGate: CounselApprovalUseCase;
  events: RunEventBus;
  catalog: ContractCatalogPort;
}): Router {
  const router = Router();

  router.post("/run", async (req, res) => {
    try {
      const language =
        req.body?.language === "ar" || req.body?.language === "both" ? req.body.language : "en";
      let contractId = String(req.body?.contractId ?? "");
      let text = String(req.body?.text ?? "");
      if (text.trim().length === 0 && contractId) {
        const doc = await deps.catalog.get(contractId);
        if (!doc) {
          res.status(404).json({ error: "NOT_FOUND", message: "Contract not found." });
          return;
        }
        text = doc.text;
        contractId = doc.id;
      }
      if (text.trim().length === 0) {
        res.status(400).json({ error: "INVALID_INPUT", message: "Contract text or contractId is required." });
        return;
      }
      const { runId } = await deps.orchestrator.enqueue({
        contractId: contractId || "contract-unknown",
        text,
        language,
      });
      res.status(202).json({ runId, state: "INIT" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown-error";
      res.status(500).json({ error: "WORKFLOW_FAILED", message });
    }
  });

  router.get("/stream/:runId", async (req, res) => {
    const runId = req.params.runId;
    if (!runId) {
      res.status(400).json({ error: "INVALID_INPUT", message: "runId is required." });
      return;
    }
    try {
      await deps.orchestrator.getRun(runId);
    } catch (err) {
      if (err instanceof RunNotFoundError) {
        res.status(404).json({ error: err.code, message: err.message });
        return;
      }
      throw err;
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    deps.orchestrator.clearScheduledCancel(runId);

    const unsubscribe = deps.events.subscribe(runId, (event) => {
      if (!res.writableEnded) {
        writeSse(res, event);
      }
    });

    const heartbeat = setInterval(() => {
      if (!res.writableEnded) {
        writeSse(res, { type: "ping", at: Date.now() });
      }
    }, 15000);

    const onClose = (): void => {
      clearInterval(heartbeat);
      unsubscribe();
      deps.orchestrator.scheduleCancel(runId);
      if (!res.writableEnded) {
        res.end();
      }
    };

    req.on("close", onClose);
  });

  router.get("/:runId", async (req, res) => {
    const runId = req.params.runId;
    if (!runId) {
      res.status(400).json({ error: "INVALID_INPUT", message: "runId is required." });
      return;
    }
    try {
      const run = await deps.orchestrator.getRun(runId);
      res.json(runSnapshot(run));
    } catch (err) {
      if (err instanceof RunNotFoundError) {
        res.status(404).json({ error: err.code, message: err.message });
        return;
      }
      const message = err instanceof Error ? err.message : "unknown-error";
      res.status(500).json({ error: "WORKFLOW_FAILED", message });
    }
  });

  router.post("/:runId/cancel", (req, res) => {
    const runId = req.params.runId;
    if (!runId) {
      res.status(400).json({ error: "INVALID_INPUT", message: "runId is required." });
      return;
    }
    deps.orchestrator.cancel(runId);
    res.status(202).json({ runId, cancelled: true });
  });

  router.post("/:runId/approve", async (req, res) => {
    const runId = req.params.runId;
    if (!runId) {
      res.status(400).json({ error: "INVALID_INPUT", message: "runId is required." });
      return;
    }
    try {
      const run = await deps.counselGate.approveRun(runId, String(req.body?.counselId ?? "counsel"));
      res.json(runSnapshot(run));
    } catch (err) {
      sendHitlError(res, err);
    }
  });

  router.post("/:runId/reject", async (req, res) => {
    const runId = req.params.runId;
    if (!runId) {
      res.status(400).json({ error: "INVALID_INPUT", message: "runId is required." });
      return;
    }
    try {
      const run = await deps.counselGate.rejectRun(
        runId,
        String(req.body?.reason ?? req.body?.comments ?? ""),
        String(req.body?.counselId ?? "counsel"),
      );
      res.json(runSnapshot(run));
    } catch (err) {
      sendHitlError(res, err);
    }
  });

  router.post("/:runId/edit-and-approve", async (req, res) => {
    const runId = req.params.runId;
    if (!runId) {
      res.status(400).json({ error: "INVALID_INPUT", message: "runId is required." });
      return;
    }
    try {
      const editedMemo = {
        ...(typeof req.body?.bodyEn === "string" ? { bodyEn: req.body.bodyEn as string } : {}),
        ...(typeof req.body?.bodyAr === "string" ? { bodyAr: req.body.bodyAr as string } : {}),
        ...(typeof req.body?.editedMemo === "string" ? { bodyEn: req.body.editedMemo as string } : {}),
      };
      const run = await deps.counselGate.editAndApproveRun(
        runId,
        editedMemo,
        String(req.body?.counselId ?? "counsel"),
      );
      res.json(runSnapshot(run));
    } catch (err) {
      sendHitlError(res, err);
    }
  });

  return router;
}

function sendHitlError(res: Response, err: unknown): void {
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
