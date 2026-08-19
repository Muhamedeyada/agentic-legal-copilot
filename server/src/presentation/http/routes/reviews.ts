import { Router } from "express";
import { ApprovalRequiredError } from "../../../domain/errors.js";
import type { ReviewOrchestrator } from "../../../application/orchestrator.js";

export function reviewsRouter(orchestrator: ReviewOrchestrator): Router {
  const router = Router();

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
      const message = err instanceof Error ? err.message : "unknown-error";
      res.status(501).json({ error: "NOT_IMPLEMENTED", message });
    }
  });

  return router;
}
