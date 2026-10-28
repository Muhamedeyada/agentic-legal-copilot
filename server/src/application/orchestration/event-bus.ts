import type { WorkflowEventListener, WorkflowStreamEvent } from "./events.js";

const HISTORY_CAP = 500;

export class RunEventBus {
  private readonly listeners = new Map<string, Set<WorkflowEventListener>>();
  private readonly history = new Map<string, WorkflowStreamEvent[]>();

  publish(event: WorkflowStreamEvent): void {
    const bucket = this.history.get(event.runId) ?? [];
    const last = bucket.at(-1);
    // Token chunks are merged in the replay history so a late subscriber gets the text so far in one
    // event, and hundreds of deltas cannot evict clause/risk events from the capped history.
    if (
      event.type === "TOKEN_CHUNK" &&
      !event.reset &&
      last?.type === "TOKEN_CHUNK" &&
      !last.reset &&
      last.field === event.field
    ) {
      bucket[bucket.length - 1] = { ...last, at: event.at, deltaText: last.deltaText + event.deltaText };
    } else {
      bucket.push(event);
    }
    if (bucket.length > HISTORY_CAP) {
      bucket.splice(0, bucket.length - HISTORY_CAP);
    }
    this.history.set(event.runId, bucket);
    const subs = this.listeners.get(event.runId);
    if (!subs) {
      return;
    }
    for (const listener of subs) {
      listener(event);
    }
  }

  subscribe(runId: string, listener: WorkflowEventListener): () => void {
    const replay = this.history.get(runId) ?? [];
    for (const event of replay) {
      listener(event);
    }
    const set = this.listeners.get(runId) ?? new Set<WorkflowEventListener>();
    set.add(listener);
    this.listeners.set(runId, set);
    return () => {
      set.delete(listener);
      if (set.size === 0) {
        this.listeners.delete(runId);
      }
    };
  }

  historyFor(runId: string): readonly WorkflowStreamEvent[] {
    return this.history.get(runId) ?? [];
  }
}
