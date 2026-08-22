export class ApprovalRequiredError extends Error {
  readonly code = "APPROVAL_REQUIRED";

  constructor(message = "Counsel approval is required before this operation.") {
    super(message);
    this.name = "ApprovalRequiredError";
  }
}

export class InvalidStateTransitionError extends Error {
  readonly code = "INVALID_STATE_TRANSITION";

  constructor(from: string, to: string) {
    super(`Cannot transition workflow from ${from} to ${to}.`);
    this.name = "InvalidStateTransitionError";
  }
}

export class MaxIterationsError extends Error {
  readonly code = "MAX_ITERATIONS";

  constructor(max: number) {
    super(`Workflow exceeded max iterations (${max}).`);
    this.name = "MaxIterationsError";
  }
}

export class StepTimeoutError extends Error {
  readonly code = "STEP_TIMEOUT";

  constructor(step: string, timeoutMs: number) {
    super(`Step ${step} exceeded timeout of ${timeoutMs}ms.`);
    this.name = "StepTimeoutError";
  }
}

export class ToolNotAllowedError extends Error {
  readonly code = "TOOL_NOT_ALLOWED";

  constructor(agentId: string, toolName: string) {
    super(`Agent ${agentId} is not allowed to call ${toolName}.`);
    this.name = "ToolNotAllowedError";
  }
}

export class SchemaViolationError extends Error {
  readonly code = "SCHEMA_VIOLATION";

  constructor(schemaName: string, detail: string) {
    super(`Typed contract ${schemaName} failed validation: ${detail}`);
    this.name = "SchemaViolationError";
  }
}

export class RunNotFoundError extends Error {
  readonly code = "RUN_NOT_FOUND";

  constructor(runId: string) {
    super(`Workflow run ${runId} was not found.`);
    this.name = "RunNotFoundError";
  }
}

export class RunCancelledError extends Error {
  readonly code = "RUN_CANCELLED";

  constructor(runId: string) {
    super(`Workflow run ${runId} was cancelled.`);
    this.name = "RunCancelledError";
  }
}
