import cors from "cors";
import express, { type Express } from "express";
import type { AppConfig } from "../../infrastructure/config.js";
import { ReviewOrchestrator } from "../../application/orchestrator.js";
import { healthRouter } from "./routes/health.js";
import { sseRouter } from "./routes/sse.js";
import { reviewsRouter } from "./routes/reviews.js";

export interface HttpDeps {
  readonly config: AppConfig;
  readonly orchestrator: ReviewOrchestrator;
}

export function createApp(deps: HttpDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use(
    cors({
      origin: deps.config.clientOrigin,
    }),
  );

  app.use("/health", healthRouter(deps.config));
  app.use("/events", sseRouter());
  app.use("/reviews", reviewsRouter(deps.orchestrator));

  return app;
}
