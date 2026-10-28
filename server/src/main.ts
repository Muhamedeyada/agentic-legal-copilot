import { app, services, config } from "./app.js";

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
