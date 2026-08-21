import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { createServices } from "../infrastructure/composition.js";

loadEnv({ path: resolve(process.cwd(), "../.env") });
loadEnv({ path: resolve(process.cwd(), ".env") });

const services = createServices();
const result = await services.ingest.execute();
const stats = await services.store.stats();

console.log(`Embedding: ${services.embeddings.model} (${services.embeddings.dimensions}d)`);
console.log(`Index documents=${stats.documents} chunks=${stats.chunks}`);
console.log("");
console.log("document_id\tstatus\tchunks\terror");
for (const row of result.documents) {
  const err = row.error ?? "";
  console.log(`${row.documentId}\t${row.status}\t${row.chunkCount}\t${err}`);
}
console.log("");
console.log(
  `Summary: ingested=${result.ingested} skipped=${result.skipped} failed=${result.failed} new_chunks=${result.chunks}`,
);

if (result.failed > 0) {
  process.exitCode = 1;
}
