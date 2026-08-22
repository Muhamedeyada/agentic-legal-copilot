import { Router } from "express";
import type { DirectRagUseCase } from "../../../application/chat/direct-rag.js";

export function chatRouter(rag: DirectRagUseCase): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const query = String(req.body?.query ?? req.body?.question ?? "").trim();
    if (query.length === 0) {
      res.status(400).json({ error: "INVALID_INPUT", message: "query is required." });
      return;
    }
    const language = req.body?.language === "ar" || req.body?.language === "en" ? req.body.language : undefined;
    const documentId = typeof req.body?.documentId === "string" ? req.body.documentId : undefined;
    const result = await rag.ask({
      query,
      ...(language ? { language } : {}),
      ...(documentId ? { documentId } : {}),
    });
    if (result.refused) {
      res.status(404).json({
        error: "NOT_ENOUGH_INFORMATION",
        refused: true,
        reason: result.reason ?? "not_enough_information",
        citations: result.citations,
        answer: "",
      });
      return;
    }
    res.json(result);
  });

  return router;
}
