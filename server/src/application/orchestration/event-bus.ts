import type { WorkflowEventListener, WorkflowStreamEvent } from "./events.js";

const HISTORY_CAP = 500;

/** In-process pub/sub for run progress. Presentation maps this onto SSE. */
export class RunEventBus {
  private readonly listeners = new Map<string, Set<WorkflowEventListener>>();
  private readonly history = new Map<string, WorkflowStreamEvent[]>();

  publish(event: WorkflowStreamEvent): void {
    const bucket = this.history.get(event.runId) ?? [];
    bucket.push(event);
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
