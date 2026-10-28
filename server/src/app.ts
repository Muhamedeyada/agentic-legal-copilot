import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { loadConfig } from "./infrastructure/config.js";
import { createLegalServices, type LegalServices } from "./infrastructure/composition.js";
import { createApp } from "./presentation/http/app.js";
import type { Express } from "express";

loadEnv({ path: resolve(process.cwd(), "../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const config = loadConfig();
const services: LegalServices = createLegalServices(config);
const app: Express = createApp({
  config,
  orchestrator: services.orchestrator,
  counselGate: services.counselGate,
  events: services.events,
  catalog: services.catalog,
  rag: services.rag,
  ingest: services.ingest,
});

export { app, services, config, createApp };
export default app;
