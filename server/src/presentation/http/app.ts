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

export function createApp(deps: HttpDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2mb" }));
  app.use(
    cors({
      origin: deps.config.clientOrigin,
    }),
  );

  app.use("/health", healthRouter(deps.config));
  app.use("/api/health", healthRouter(deps.config));
  app.use("/events", sseRouter());
  app.use("/reviews", reviewsRouter(deps.orchestrator, deps.counselGate));
  app.use("/api/contracts", contractsRouter(deps.catalog));
  app.use("/api/chat", chatRouter(deps.rag));
  app.use(
    "/api/workflow",
    workflowRouter({
      orchestrator: deps.orchestrator,
      counselGate: deps.counselGate,
      events: deps.events,
      catalog: deps.catalog,
    }),
  );

  return app;
}
