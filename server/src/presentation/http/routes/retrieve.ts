import { Router } from "express";
import type { HybridRetrieveUseCase } from "../../../application/hybrid-retrieve.js";

export function retrieveRouter(retrieve: HybridRetrieveUseCase): Router {
  const router = Router();

  router.post("/", async (req, res) => {
    const text = typeof req.body?.query === "string" ? req.body.query : typeof req.body?.text === "string" ? req.body.text : "";
    const language = req.body?.language === "ar" || req.body?.language === "en" ? req.body.language : undefined;
    const topK = typeof req.body?.topK === "number" ? req.body.topK : undefined;
    const documentId = typeof req.body?.documentId === "string" ? req.body.documentId : undefined;

    const result = await retrieve.execute({
      text,
      ...(topK !== undefined ? { topK } : {}),
      ...(language !== undefined ? { language } : {}),
      ...(documentId !== undefined ? { documentId } : {}),
    });

    if (result.refused) {
      res.status(404).json({
        error: "NOT_ENOUGH_INFORMATION",
        reason: result.reason,
        message: "Not enough information in the corpus.",
        citations: [],
      });
      return;
    }

    res.json(result);
  });

  return router;
}
