import type { RunStorePort } from "../../domain/ports/run-store.port.js";
import { SaveDraftMemoInputZ, SaveDraftMemoOutputZ, toReviewMemo } from "../agents/schemas.js";
import type { ToolDefinition } from "./registry.js";
import type { z } from "zod";

export type SaveDraftMemoInput = z.infer<typeof SaveDraftMemoInputZ>;
export type SaveDraftMemoOutput = z.infer<typeof SaveDraftMemoOutputZ>;

/**
 * Write tool. Persists the memo in PENDING_APPROVAL only.
 * Counsel must approve / reject / edit-and-approve before finalization.
 */
export function createSaveDraftMemoTool(deps: {
  runs: RunStorePort;
}): ToolDefinition<SaveDraftMemoInput, SaveDraftMemoOutput> {
  return {
    name: "save_draft_memo_tool",
    inputSchema: SaveDraftMemoInputZ,
    outputSchema: SaveDraftMemoOutputZ,
    sideEffecting: true,
    async execute(input, ctx) {
      const run = await deps.runs.get(ctx.runId);
      if (!run) {
        throw new Error(`Cannot save draft: run ${ctx.runId} not found.`);
      }
      run.memo = toReviewMemo({ ...input.memo, approvedByCounsel: false });
      run.updatedAt = new Date().toISOString();
      await deps.runs.save(run);
      return { status: "PENDING_APPROVAL" as const, memoId: input.memo.id };
    },
  };
}
