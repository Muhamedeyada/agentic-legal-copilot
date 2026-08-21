import cors from "cors";
import express, { type Express } from "express";
import type { HybridRetrieveUseCase } from "../../application/hybrid-retrieve.js";
import { ReviewOrchestrator } from "../../application/orchestrator.js";
import type { AppConfig } from "../../infrastructure/config.js";
import { healthRouter } from "./routes/health.js";
import { retrieveRouter } from "./routes/retrieve.js";
import { reviewsRouter } from "./routes/reviews.js";
import { sseRouter } from "./routes/sse.js";

export interface HttpDeps {
  readonly config: AppConfig;
  readonly orchestrator: ReviewOrchestrator;
  readonly retrieve: HybridRetrieveUseCase;
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
  app.use("/retrieve", retrieveRouter(deps.retrieve));

  return app;
}
