import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { loadConfig } from "./infrastructure/config.js";
import { createLegalServices } from "./infrastructure/composition.js";
import { createApp } from "./presentation/http/app.js";

loadEnv({ path: resolve(process.cwd(), "../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const config = loadConfig();
const services = createLegalServices(config);
const app = createApp({
  config,
  orchestrator: services.orchestrator,
  counselGate: services.counselGate,
  events: services.events,
  catalog: services.catalog,
  rag: services.rag,
});

const server = app.listen(config.port, config.host, () => {
  console.log(
    `[alc-server] D1T1 listening on http://${config.host}:${config.port} (provider=${config.llmProvider}, persistence=${services.databasePath ?? "memory"})`,
  );
});

void services.interruptedRuns.then((count) => {
  if (count > 0) {
    console.log(`[alc-server] marked ${count} interrupted run(s) as FAILED`);
  }
});

function shutdown(): void {
  server.close(() => {
    services.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
