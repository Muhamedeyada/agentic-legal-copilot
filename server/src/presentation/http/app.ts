import cors from "cors";
import express, { type Express } from "express";
import type { AppConfig } from "../../infrastructure/config.js";
import type { LegalWorkflowOrchestrator } from "../../application/orchestrator.js";
import type { CounselApprovalUseCase } from "../../application/hitl/counsel-approval.js";
import { healthRouter } from "./routes/health.js";
import { sseRouter } from "./routes/sse.js";
import { reviewsRouter } from "./routes/reviews.js";
import { rateLimitMiddleware } from "./rate-limit.middleware.js";

export interface HttpDeps {
  readonly config: AppConfig;
  readonly orchestrator: LegalWorkflowOrchestrator;
  readonly counselGate: CounselApprovalUseCase;
}

export function createApp(deps: HttpDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(rateLimitMiddleware(deps.config.rateLimitPerMinute));
  app.use((req, res, next) => {
    const text = req.body?.text;
    if (typeof text === "string" && text.length > deps.config.maxUploadChars) {
      res.status(413).json({
        error: "PAYLOAD_TOO_LARGE",
        message: `Contract text exceeds ${deps.config.maxUploadChars} characters.`,
      });
      return;
    }
    next();
  });
  app.use(
    cors({
      origin: deps.config.clientOrigin,
    }),
  );

  app.use("/health", healthRouter(deps.config));
  app.use("/events", sseRouter());
  app.use("/reviews", reviewsRouter(deps.orchestrator, deps.counselGate));

  return app;
}
