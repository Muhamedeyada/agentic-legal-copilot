import { Router } from "express";
import type { AppConfig } from "../../../infrastructure/config.js";

export function healthRouter(config: AppConfig): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json({
      status: "ok",
      variant: "D1T1",
      locale: config.defaultLocale,
      requireCounselApproval: config.requireCounselApproval,
      llmProvider: config.llmProvider,
    });
  });

  return router;
}
