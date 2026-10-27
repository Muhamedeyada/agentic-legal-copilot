import cors from "cors";
import express, { type Express } from "express";
import type { AppConfig } from "../../infrastructure/config.js";
import type { LegalWorkflowOrchestrator } from "../../application/orchestrator.js";
import type { CounselApprovalUseCase } from "../../application/hitl/counsel-approval.js";
import type { RunEventBus } from "../../application/orchestration/event-bus.js";
import type { ContractCatalogPort } from "../../domain/ports/contract-catalog.port.js";
import type { DirectRagUseCase } from "../../application/chat/direct-rag.js";
import { healthRouter } from "./routes/health.js";
import { sseRouter } from "./routes/sse.js";
import { reviewsRouter } from "./routes/reviews.js";
import { rateLimitMiddleware } from "./rate-limit.middleware.js";
import { authenticate } from "./middleware/auth.js";
import { contractsRouter } from "./routes/contracts.js";
import { chatRouter } from "./routes/chat.js";
import { workflowRouter } from "./routes/workflow.js";

export interface HttpDeps {
  readonly config: AppConfig;
  readonly orchestrator: LegalWorkflowOrchestrator;
  readonly counselGate: CounselApprovalUseCase;
  readonly events: RunEventBus;
  readonly catalog: ContractCatalogPort;
  readonly rag: DirectRagUseCase;
}

export function parseOrigins(raw: string): string | string[] {
  const parts = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  if (parts.length === 0) {
    return "http://localhost:5173";
  }
  return parts.length === 1 ? (parts[0] ?? "http://localhost:5173") : parts;
}

export function createApp(deps: HttpDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));
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
      origin: parseOrigins(deps.config.clientOrigin),
    }),
  );

  app.use("/health", healthRouter(deps.config));
  app.use("/api/health", healthRouter(deps.config));
  const auth = authenticate(deps.config);
  app.use("/events", auth, sseRouter());
  app.use("/reviews", auth, reviewsRouter(deps.orchestrator, deps.counselGate));
  app.use("/api/contracts", auth, contractsRouter(deps.catalog));
  app.use("/api/chat", auth, chatRouter(deps.rag));
  app.use(
    "/api/workflow",
    auth,
    workflowRouter({
      orchestrator: deps.orchestrator,
      counselGate: deps.counselGate,
      events: deps.events,
      catalog: deps.catalog,
    }),
  );

  return app;
}
