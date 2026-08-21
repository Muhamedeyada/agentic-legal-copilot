import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { createServices } from "./infrastructure/composition.js";
import { createApp } from "./presentation/http/app.js";

loadEnv({ path: resolve(process.cwd(), "../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const services = createServices();
const app = createApp({
  config: services.config,
  orchestrator: services.orchestrator,
  retrieve: services.retrieve,
});

app.listen(services.config.port, services.config.host, () => {
  console.log(
    `[alc-server] D1T1 listening on http://${services.config.host}:${services.config.port} (embed=${services.embeddings.model})`,
  );
});
