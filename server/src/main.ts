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
});

app.listen(config.port, config.host, () => {
  console.log(
    `[alc-server] D1T1 listening on http://${config.host}:${config.port} (provider=${config.llmProvider})`,
  );
});
