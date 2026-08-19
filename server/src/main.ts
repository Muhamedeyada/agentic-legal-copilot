import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { ReviewOrchestrator } from "./application/orchestrator.js";
import { loadConfig } from "./infrastructure/config.js";
import { InMemoryApprovalAdapter } from "./infrastructure/approval/in-memory.adapter.js";
import { createCompletionAdapter } from "./infrastructure/llm/factory.js";
import { InMemoryVectorStoreAdapter } from "./infrastructure/vector/in-memory.adapter.js";
import { createApp } from "./presentation/http/app.js";

loadEnv({ path: resolve(process.cwd(), "../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const config = loadConfig();

const orchestrator = new ReviewOrchestrator({
  completion: createCompletionAdapter(config),
  vectors: new InMemoryVectorStoreAdapter(),
  approval: new InMemoryApprovalAdapter(),
  requireCounselApproval: config.requireCounselApproval,
});

const app = createApp({ config, orchestrator });

app.listen(config.port, config.host, () => {
  console.log(
    `[alc-server] D1T1 listening on http://${config.host}:${config.port} (provider=${config.llmProvider})`,
  );
});
